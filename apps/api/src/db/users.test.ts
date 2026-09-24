import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertUser } from '../test/fixtures.ts';
import { createTestDatabase, type TestDatabase } from '../test/test-database.ts';
import { changeLog } from './schema.ts';

describe('users table', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  it('stores a user as active with token version zero and no password yet', async () => {
    const user = await insertUser(database.db);

    expect(user).toMatchObject({ isActive: true, tokenVersion: 0, passwordHash: null });
  });

  it('gives a country HR user exactly one country and a global HR user none', async () => {
    await expect(
      insertUser(database.db, { role: 'country_hr', countryCode: 'AU' }),
    ).resolves.toBeDefined();
    await expect(insertUser(database.db, { role: 'country_hr' })).rejects.toThrow();
    await expect(
      insertUser(database.db, { role: 'global_hr', countryCode: 'AU' }),
    ).rejects.toThrow();
  });

  it('keeps emails unique and in lower case', async () => {
    await insertUser(database.db, { email: 'same@acme.example.com' });

    await expect(insertUser(database.db, { email: 'same@acme.example.com' })).rejects.toThrow();
    await expect(insertUser(database.db, { email: 'Upper@acme.example.com' })).rejects.toThrow();
  });

  it('links change log entries to an existing user', async () => {
    const entry = {
      entityType: 'user' as const,
      entityId: randomUUID(),
      action: 'created' as const,
      changes: {},
      changedAt: new Date('2026-09-24T10:00:00Z'),
    };
    const user = await insertUser(database.db);

    await expect(
      database.db.insert(changeLog).values({ ...entry, changedBy: user.id }),
    ).resolves.toBeDefined();
    await expect(
      database.db.insert(changeLog).values({ ...entry, changedBy: randomUUID() }),
    ).rejects.toThrow();
  });
});
