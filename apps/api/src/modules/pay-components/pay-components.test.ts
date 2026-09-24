import { payComponentListResponseSchema } from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('GET /api/pay-components', () => {
  let globalCookie: string;
  let usCookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    globalCookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
    usCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'US' }),
    );
  });

  async function list(cookie: string, query: Record<string, string> = {}) {
    const { app } = await createTestApp();
    const response = await request(app)
      .get('/api/pay-components')
      .query(query)
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    return payComponentListResponseSchema.parse(response.body);
  }

  it('lists every component for global HR users, with the eight frequencies', async () => {
    const body = await list(globalCookie);

    expect(new Set(body.items.map((item) => item.countryCode))).toEqual(
      new Set([null, 'IN', 'US', 'CA', 'AU']),
    );
    expect(body.items).toContainEqual(
      expect.objectContaining({
        code: 'basic',
        name: 'Basic',
        category: 'earning',
        countryCode: 'IN',
        defaultFrequency: 'monthly',
        isActive: true,
      }),
    );
    expect(body.frequencies.map((frequency) => frequency.code)).toEqual([
      'weekly',
      'bi_weekly',
      'monthly',
      'bi_monthly',
      'quarterly',
      'bi_quarterly',
      'half_yearly',
      'yearly',
    ]);
  });

  it('gives the components usable in one country: its own and those for all countries', async () => {
    const body = await list(globalCookie, { country: 'CA' });

    expect(new Set(body.items.map((item) => item.countryCode))).toEqual(new Set([null, 'CA']));
    expect(body.items[0]?.countryCode).toBeNull();
  });

  it("keeps country HR users to their own country's components", async () => {
    const own = await list(usCookie);
    const other = await list(usCookie, { country: 'IN' });

    expect(new Set(own.items.map((item) => item.countryCode))).toEqual(new Set([null, 'US']));
    expect(new Set(other.items.map((item) => item.countryCode))).toEqual(new Set([null]));
  });

  it('asks for a session', async () => {
    const { app } = await createTestApp();

    expect((await request(app).get('/api/pay-components')).status).toBe(401);
  });
});
