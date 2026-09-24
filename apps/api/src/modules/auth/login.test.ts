import { currentUserResponseSchema } from '@salary/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { users } from '../../db/schema.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase, testClock } from '../../test/test-app.ts';
import { hashPassword } from './passwords.ts';

const password = 'correct horse battery staple';

describe('login, logout and current user', () => {
  let userId: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    const passwordHash = await hashPassword(password);
    userId = (
      await insertUser(db, {
        email: 'hr.in@acme.example.com',
        name: 'India HR',
        role: 'country_hr',
        countryCode: 'IN',
        passwordHash,
      })
    ).id;
    await insertUser(db, { email: 'left@acme.example.com', passwordHash, isActive: false });
    await insertUser(db, { email: 'invited@acme.example.com' });
  });

  function sessionCookie(response: request.Response) {
    const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
    return cookies?.find((cookie) => cookie.startsWith('session=')) ?? '';
  }

  it('signs in with a valid email and password and sets an httpOnly session cookie', async () => {
    const { app } = await createTestApp();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: ' HR.IN@acme.example.com ', password });

    expect(response.status).toBe(200);
    expect(currentUserResponseSchema.parse(response.body)).toEqual({
      user: {
        id: userId,
        email: 'hr.in@acme.example.com',
        name: 'India HR',
        role: 'country_hr',
        countryCode: 'IN',
      },
    });
    const cookie = sessionCookie(response);
    expect(cookie).toMatch(/^session=[\w-]+\.[\w-]+\.[\w-]+;/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=28800');
    expect(cookie).not.toContain('Secure');
    expect(JSON.stringify(response.body)).not.toContain('argon2');
  });

  it('marks the cookie Secure when secure cookies are on', async () => {
    const { app } = await createTestApp({ secureCookies: true });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hr.in@acme.example.com', password });

    expect(sessionCookie(response)).toContain('Secure');
  });

  it('records the time of the last sign-in', async () => {
    const { db } = await sharedTestDatabase();
    const { app } = await createTestApp({ clock: testClock('2026-09-25T08:30:00Z') });

    await request(app).post('/api/auth/login').send({ email: 'hr.in@acme.example.com', password });

    const [user] = await db
      .select({ lastLoginAt: users.lastLoginAt })
      .from(users)
      .where(eq(users.id, userId));
    expect(user?.lastLoginAt).toEqual(new Date('2026-09-25T08:30:00Z'));
  });

  it.each([
    ['a wrong password', 'hr.in@acme.example.com', 'wrong password'],
    ['an unknown email', 'nobody@acme.example.com', password],
    ['an inactive user', 'left@acme.example.com', password],
    ['a user who has not set a password', 'invited@acme.example.com', password],
  ])('gives the same 401 answer for %s, without a cookie', async (_case, email, attempt) => {
    const { app } = await createTestApp();

    const response = await request(app).post('/api/auth/login').send({ email, password: attempt });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      title: 'Unauthorized',
      detail: 'Email or password is incorrect',
    });
    expect(sessionCookie(response)).toBe('');
  });

  it('returns 400 with the fields to fix when the request is invalid', async () => {
    const { app } = await createTestApp();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      title: 'Bad Request',
      errors: [
        { field: 'email', message: 'Enter a valid email address' },
        { field: 'password', message: 'Enter your password' },
      ],
    });
  });

  it('returns the current user for a valid session and 401 without one', async () => {
    const { app } = await createTestApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hr.in@acme.example.com', password });

    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(login));
    const anonymous = await request(app).get('/api/auth/me');

    expect(me.status).toBe(200);
    expect(me.body).toEqual(login.body);
    expect(anonymous.status).toBe(401);
  });

  it('clears the session cookie on logout', async () => {
    const { app } = await createTestApp();

    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(204);
    expect(sessionCookie(response)).toMatch(/^session=;/);
    expect(sessionCookie(response)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
