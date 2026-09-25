import { FILE_TRANSFERS_PAUSED_MESSAGE } from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('import and export while paused', () => {
  let cookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    cookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
  });

  it('answer 503 with the reason for every import and export request', async () => {
    const { app } = await createTestApp({ fileTransfers: 'paused' });
    const responses = [
      await request(app).get('/api/exports?format=csv').set('Cookie', cookie),
      await request(app).get('/api/imports/template?format=xlsx').set('Cookie', cookie),
      await request(app)
        .post('/api/imports/validate')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'fetch')
        .attach('file', Buffer.from('Employee code\r\n', 'utf8'), 'employees.csv'),
      await request(app)
        .post('/api/imports/commit')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'fetch')
        .attach('file', Buffer.from('Employee code\r\n', 'utf8'), 'employees.csv'),
    ];

    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ status: 503, detail: FILE_TRANSFERS_PAUSED_MESSAGE });
    }
  });

  it('still asks for a session first', async () => {
    const { app } = await createTestApp({ fileTransfers: 'paused' });

    const response = await request(app).get('/api/exports?format=csv');

    expect(response.status).toBe(401);
  });

  it('leaves the rest of the API working', async () => {
    const { app } = await createTestApp({ fileTransfers: 'paused' });

    const response = await request(app).get('/api/employees').set('Cookie', cookie);

    expect(response.status).toBe(200);
  });
});
