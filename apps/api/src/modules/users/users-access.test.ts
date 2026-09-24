import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('user management access', () => {
  let countryHrCookie: string;
  let targetId: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    countryHrCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
    targetId = (await insertUser(db)).id;
  });

  const endpoints = () =>
    [
      ['GET', '/api/users', undefined],
      [
        'POST',
        '/api/users',
        {
          name: 'New User',
          email: `new-${randomUUID()}@acme.example.com`,
          role: 'global_hr',
          countryCode: null,
        },
      ],
      ['PATCH', `/api/users/${targetId}`, { isActive: false }],
      ['POST', `/api/users/${targetId}/invite`, undefined],
      ['GET', `/api/users/${targetId}/change-log`, undefined],
    ] as const;

  function call(
    app: Awaited<ReturnType<typeof createTestApp>>['app'],
    [method, path, body]: ReturnType<typeof endpoints>[number],
  ) {
    const agent = request(app);
    const req =
      method === 'GET' ? agent.get(path) : method === 'POST' ? agent.post(path) : agent.patch(path);
    return body === undefined ? req : req.send(body);
  }

  it('refuses country HR users with 403 on every endpoint', async () => {
    const { app } = await createTestApp();

    for (const endpoint of endpoints()) {
      const response = await call(app, endpoint).set('Cookie', countryHrCookie);
      expect(response.status, `${endpoint[0]} ${endpoint[1]}`).toBe(403);
      expect(response.body).toMatchObject({ detail: 'Only global HR users can manage users' });
    }
  });

  it('refuses signed-out requests with 401 on every endpoint', async () => {
    const { app } = await createTestApp();

    for (const endpoint of endpoints()) {
      expect((await call(app, endpoint)).status, `${endpoint[0]} ${endpoint[1]}`).toBe(401);
    }
  });
});
