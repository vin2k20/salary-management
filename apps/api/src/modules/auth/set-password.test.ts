import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { changeLog } from '../../db/schema.ts';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase, testClock } from '../../test/test-app.ts';
import { issueAuthToken } from './auth-tokens.ts';
import { hashPassword } from './passwords.ts';

const oldPassword = 'the old password';
const newPassword = 'a brand new password';
const invalidLink = 'This link is invalid or has expired. Ask for a new one.';

describe('POST /api/auth/set-password', () => {
  async function setUp(options: { invited?: boolean; isActive?: boolean } = {}) {
    const { db } = await sharedTestDatabase();
    const clock = testClock();
    const { app } = await createTestApp({ clock });
    const user = await insertUser(db, {
      passwordHash: options.invited ? null : await hashPassword(oldPassword),
      isActive: options.isActive ?? true,
    });
    const token = await issueAuthToken(
      db,
      { userId: user.id, purpose: options.invited ? 'invite' : 'reset' },
      clock,
    );
    const setPassword = (password = newPassword, withToken = token) =>
      request(app).post('/api/auth/set-password').send({ token: withToken, password });
    const login = (password: string) =>
      request(app).post('/api/auth/login').send({ email: user.email, password });
    return { db, app, clock, user, token, setPassword, login };
  }

  it('sets a new password from a reset link', async () => {
    const { setPassword, login } = await setUp();

    const response = await setPassword();

    expect(response.status).toBe(204);
    expect((await login(newPassword)).status).toBe(200);
    expect((await login(oldPassword)).status).toBe(401);
  });

  it('signs out older sessions', async () => {
    const { app, user, setPassword } = await setUp();
    const oldSession = await sessionCookieFor(user);
    expect((await request(app).get('/api/auth/me').set('Cookie', oldSession)).status).toBe(200);

    await setPassword();

    expect((await request(app).get('/api/auth/me').set('Cookie', oldSession)).status).toBe(401);
  });

  it('lets an invited user choose their first password and sign in', async () => {
    const { setPassword, login } = await setUp({ invited: true });

    expect((await setPassword()).status).toBe(204);
    expect((await login(newPassword)).status).toBe(200);
  });

  it('refuses a link that was already used', async () => {
    const { setPassword } = await setUp();

    await setPassword();
    const second = await setPassword('another new password');

    expect(second.status).toBe(400);
    expect(second.body).toMatchObject({ detail: invalidLink });
  });

  it('refuses a link after it expires', async () => {
    const { clock, setPassword, login } = await setUp();

    clock.advance(31 * 60 * 1000);
    const response = await setPassword();

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ detail: invalidLink });
    expect((await login(oldPassword)).status).toBe(200);
  });

  it('refuses a link for a deactivated user', async () => {
    const { setPassword } = await setUp({ isActive: false });

    const response = await setPassword();

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ detail: invalidLink });
  });

  it('checks the new password before using the link', async () => {
    const { setPassword } = await setUp();

    const short = await setPassword('too short');
    expect(short.status).toBe(400);
    expect(short.body).toMatchObject({
      errors: [{ field: 'password', message: 'Use at least 12 characters' }],
    });
    expect((await setPassword()).status).toBe(204);
  });

  it('records the change in the change log without the password', async () => {
    const { db, user, setPassword } = await setUp();

    await setPassword();

    const entries = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.entityType, 'user'), eq(changeLog.entityId, user.id)));
    expect(entries).toEqual([
      expect.objectContaining({
        action: 'updated',
        changes: { password: { old: 'hidden', new: 'changed' } },
        changedBy: user.id,
        countryCode: null,
      }),
    ]);
    expect(JSON.stringify(entries)).not.toContain('argon2');
  });
});
