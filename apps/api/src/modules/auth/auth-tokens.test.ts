import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authTokens } from '../../db/schema.ts';
import { insertUser } from '../../test/fixtures.ts';
import { testClock } from '../../test/test-app.ts';
import { createTestDatabase, type TestDatabase } from '../../test/test-database.ts';
import { consumeAuthToken, issueAuthToken } from './auth-tokens.ts';

const minute = 60 * 1000;

describe('auth tokens', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  async function storedTokens(userId: string) {
    return database.db.select().from(authTokens).where(eq(authTokens.userId, userId));
  }

  it('stores only a SHA-256 hash of a 32-byte random token', async () => {
    const user = await insertUser(database.db);
    const clock = testClock();

    const token = await issueAuthToken(database.db, { userId: user.id, purpose: 'reset' }, clock);

    expect(token).toMatch(/^[\w-]{43}$/);
    const [stored] = await storedTokens(user.id);
    expect(stored?.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it('lasts 30 minutes for a reset and 72 hours for an invite', async () => {
    const user = await insertUser(database.db);
    const clock = testClock('2026-09-24T10:00:00Z');

    await issueAuthToken(database.db, { userId: user.id, purpose: 'reset' }, clock);
    await issueAuthToken(database.db, { userId: user.id, purpose: 'invite' }, clock);

    const expiry = Object.fromEntries(
      (await storedTokens(user.id)).map((row) => [row.purpose, row.expiresAt.toISOString()]),
    );
    expect(expiry).toEqual({
      reset: '2026-09-24T10:30:00.000Z',
      invite: '2026-09-27T10:00:00.000Z',
    });
  });

  it('can be used once', async () => {
    const user = await insertUser(database.db);
    const clock = testClock();
    const token = await issueAuthToken(database.db, { userId: user.id, purpose: 'invite' }, clock);

    await expect(consumeAuthToken(database.db, token, clock)).resolves.toEqual({
      userId: user.id,
      purpose: 'invite',
    });
    await expect(consumeAuthToken(database.db, token, clock)).resolves.toBeNull();
  });

  it('stops working when it expires', async () => {
    const user = await insertUser(database.db);
    const clock = testClock();
    const usable = await issueAuthToken(database.db, { userId: user.id, purpose: 'reset' }, clock);
    const expired = await issueAuthToken(
      database.db,
      { userId: (await insertUser(database.db)).id, purpose: 'reset' },
      clock,
    );

    clock.advance(30 * minute - 1000);
    await expect(consumeAuthToken(database.db, usable, clock)).resolves.not.toBeNull();
    clock.advance(2000);
    await expect(consumeAuthToken(database.db, expired, clock)).resolves.toBeNull();
  });

  it('replaces an older unused link of the same purpose', async () => {
    const user = await insertUser(database.db);
    const clock = testClock();
    const firstReset = await issueAuthToken(
      database.db,
      { userId: user.id, purpose: 'reset' },
      clock,
    );
    const invite = await issueAuthToken(database.db, { userId: user.id, purpose: 'invite' }, clock);
    const secondReset = await issueAuthToken(
      database.db,
      { userId: user.id, purpose: 'reset' },
      clock,
    );

    await expect(consumeAuthToken(database.db, firstReset, clock)).resolves.toBeNull();
    await expect(consumeAuthToken(database.db, secondReset, clock)).resolves.not.toBeNull();
    await expect(consumeAuthToken(database.db, invite, clock)).resolves.not.toBeNull();
  });

  it('ignores an unknown token', async () => {
    await expect(
      consumeAuthToken(database.db, 'not-a-real-token', testClock()),
    ).resolves.toBeNull();
  });
});
