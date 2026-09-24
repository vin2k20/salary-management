import { employeeListResponseSchema } from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertDirectoryData } from '../../test/directory-data.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('GET /api/employees within the user scope', () => {
  let indiaCookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    await insertDirectoryData(db);
    indiaCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
  });

  async function list(query: Record<string, string>) {
    const { app } = await createTestApp();
    const response = await request(app)
      .get('/api/employees')
      .query(query)
      .set('Cookie', indiaCookie);
    expect(response.status).toBe(200);
    return employeeListResponseSchema.parse(response.body);
  }

  it('lists only employees in the country HR user country', async () => {
    const body = await list({ includeInactive: 'true' });

    expect(body.total).toBe(3);
    expect(new Set(body.items.map((item) => item.countryCode))).toEqual(new Set(['IN']));
  });

  it('returns nothing when asked for another country, rather than its employees', async () => {
    const body = await list({ country: 'US' });

    expect(body).toMatchObject({ items: [], total: 0 });
  });

  it('keeps search and sorting within the country', async () => {
    const body = await list({ search: 'stone', sort: '-annualTotal' });

    expect(body.items).toEqual([]);
  });
});
