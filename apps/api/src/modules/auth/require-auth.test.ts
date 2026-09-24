import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { users } from '../../db/schema.ts';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase, testClock } from '../../test/test-app.ts';

type User = Awaited<ReturnType<typeof insertUser>>;

describe('protected routes', () => {
  let user: User;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    user = await insertUser(db, { role: 'country_hr', countryCode: 'CA' });
  });

  it('reject every API route without a session, before revealing whether it exists', async () => {
    const { app } = await createTestApp();

    const response = await request(app).get('/api/not-a-route');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ title: 'Unauthorized', detail: 'Sign in to continue' });
  });

  it('let a signed-in user through', async () => {
    const { app } = await createTestApp();

    const response = await request(app)
      .get('/api/not-a-route')
      .set('Cookie', await sessionCookieFor(user));

    expect(response.status).toBe(404);
  });

  it('keep health and login open without a session', async () => {
    const { app } = await createTestApp();

    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
  });

  it('reject a tampered token or one signed with another secret', async () => {
    const { app } = await createTestApp();
    const cookie = await sessionCookieFor(user);
    const tampered = `${cookie.slice(0, -2)}xx`;
    const otherSecret = await sessionCookieFor(user, {
      secret: 'another-secret-that-is-also-32-characters-long',
    });

    expect((await request(app).get('/api/auth/me').set('Cookie', tampered)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', otherSecret)).status).toBe(401);
  });

  it('reject a session older than eight hours', async () => {
    const clock = testClock();
    const { app } = await createTestApp({ clock });
    const cookie = await sessionCookieFor(user, { clock });

    clock.advance(8 * 60 * 60 * 1000 - 1000);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
    clock.advance(2000);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('reject a token issued before the token version was raised', async () => {
    const { db } = await sharedTestDatabase();
    const { app } = await createTestApp();
    const target = await insertUser(db);
    const oldCookie = await sessionCookieFor(target);

    await db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, target.id));

    expect((await request(app).get('/api/auth/me').set('Cookie', oldCookie)).status).toBe(401);
    const newCookie = await sessionCookieFor({ ...target, tokenVersion: target.tokenVersion + 1 });
    expect((await request(app).get('/api/auth/me').set('Cookie', newCookie)).status).toBe(200);
  });

  it('reject a deactivated user straight away', async () => {
    const { db } = await sharedTestDatabase();
    const { app } = await createTestApp();
    const target = await insertUser(db);
    const cookie = await sessionCookieFor(target);

    await db.update(users).set({ isActive: false }).where(eq(users.id, target.id));

    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });
});
