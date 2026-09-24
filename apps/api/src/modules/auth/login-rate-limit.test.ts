import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';
import { hashPassword } from './passwords.ts';

const password = 'correct horse battery staple';

describe('login rate limits', () => {
  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    const passwordHash = await hashPassword(password);
    await insertUser(db, { email: 'target@acme.example.com', passwordHash });
    await insertUser(db, { email: 'other@acme.example.com', passwordHash });
  });

  function login(
    app: Awaited<ReturnType<typeof createTestApp>>['app'],
    email: string,
    attempt: string,
  ) {
    return request(app).post('/api/auth/login').send({ email, password: attempt });
  }

  it('blocks an email after five failed attempts, even with the right password', async () => {
    const { app } = await createTestApp();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await login(app, 'target@acme.example.com', 'wrong')).status).toBe(401);
    }
    const blocked = await login(app, 'TARGET@acme.example.com', password);

    expect(blocked.status).toBe(429);
    expect(blocked.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(blocked.body).toMatchObject({
      title: 'Too Many Requests',
      detail: 'Too many sign-in attempts. Try again in 15 minutes.',
    });
    expect((await login(app, 'other@acme.example.com', password)).status).toBe(200);
  });

  it('does not count successful sign-ins towards the email limit', async () => {
    const { app } = await createTestApp();

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      expect((await login(app, 'other@acme.example.com', password)).status).toBe(200);
    }
  });

  it('blocks an IP address after twenty attempts across different emails', async () => {
    const { app } = await createTestApp();

    for (let attempt = 1; attempt <= 20; attempt += 1) {
      expect((await login(app, `unknown${String(attempt)}@acme.example.com`, 'x')).status).toBe(
        401,
      );
    }

    expect((await login(app, 'other@acme.example.com', password)).status).toBe(429);
  });
});
