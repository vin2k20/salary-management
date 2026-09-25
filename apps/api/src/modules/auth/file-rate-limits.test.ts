import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('import and export limits', () => {
  let first: string;
  let second: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    first = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
    second = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
  });

  it('allows 30 exports per user in 15 minutes', async () => {
    const { app } = await createTestApp();
    const exportAs = (cookie: string) =>
      request(app).get('/api/exports').query({ format: 'csv' }).set('Cookie', cookie);

    for (let attempt = 1; attempt <= 30; attempt += 1) {
      expect((await exportAs(first)).status).toBe(200);
    }
    const blocked = await exportAs(first);

    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      detail: 'Too many exports. Try again in 15 minutes.',
    });
    expect((await exportAs(second)).status).toBe(200);
  });

  it('allows 30 import requests per user in 15 minutes', async () => {
    const { app } = await createTestApp();
    const check = (cookie: string) =>
      request(app)
        .post('/api/imports/validate')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'fetch')
        .attach('file', Buffer.from('Employee code,First name\r\n'), 'employees.csv');

    for (let attempt = 1; attempt <= 30; attempt += 1) {
      expect((await check(first)).status).toBe(200);
    }
    const blocked = await check(first);

    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      detail: 'Too many imports. Try again in 15 minutes.',
    });
    expect((await check(second)).status).toBe(200);
  });
});
