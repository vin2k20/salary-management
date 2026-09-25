import {
  costByDepartmentResponseSchema,
  insightsSummarySchema,
  outliersResponseSchema,
  payByJobTitleResponseSchema,
  payRangeByCountryResponseSchema,
} from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { insertInsightsData } from '../../test/insights-data.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

const ENDPOINTS = [
  '/api/insights/summary',
  '/api/insights/pay-range-by-country',
  '/api/insights/by-job-title',
  '/api/insights/cost-by-department',
  '/api/insights/outliers',
];

describe('dashboard statistics within the user scope', () => {
  let indiaCookie: string;
  let globalCookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    await insertInsightsData(db);
    indiaCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
    globalCookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
  });

  async function get(path: string, cookie: string, query: Record<string, string> = {}) {
    const { app } = await createTestApp();
    const response = await request(app).get(path).query(query).set('Cookie', cookie);
    expect(response.status).toBe(200);
    return response.body as unknown;
  }

  it('needs a signed-in user for every endpoint', async () => {
    const { app } = await createTestApp();
    for (const path of ENDPOINTS) {
      const response = await request(app).get(path);
      expect(response.status, path).toBe(401);
    }
  });

  it('shows a country HR user their own country, in its currency', async () => {
    const body = insightsSummarySchema.parse(await get('/api/insights/summary', indiaCookie));

    expect(body).toMatchObject({
      countryCode: 'IN',
      rateDate: null,
      headcount: 9,
      annualCost: { amountMinor: 1_185_000_002, currency: 'INR' },
    });
    expect(body.countries.map((country) => country.countryCode)).toEqual(['IN']);
  });

  it('shows a global HR user every country', async () => {
    const body = payRangeByCountryResponseSchema.parse(
      await get('/api/insights/pay-range-by-country', globalCookie),
    );

    expect(body.items.map((item) => item.countryCode)).toEqual(['CA', 'IN', 'US']);
  });

  it('keeps pay ranges, departments and outliers within the country', async () => {
    const ranges = payRangeByCountryResponseSchema.parse(
      await get('/api/insights/pay-range-by-country', indiaCookie),
    );
    expect(ranges.items.map((item) => item.countryCode)).toEqual(['IN']);

    const departments = costByDepartmentResponseSchema.parse(
      await get('/api/insights/cost-by-department', indiaCookie),
    );
    expect(departments).toMatchObject({
      countryCode: 'IN',
      rateDate: null,
      items: [
        { department: 'Engineering', headcount: 7 },
        { department: 'Sales', headcount: 2 },
      ],
    });

    const outliers = outliersResponseSchema.parse(await get('/api/insights/outliers', indiaCookie));
    expect(outliers.items.map((item) => item.employeeCode)).toEqual(['IN-E6']);
  });

  it('compares job titles in the country HR user country without asking for one', async () => {
    const body = payByJobTitleResponseSchema.parse(
      await get('/api/insights/by-job-title', indiaCookie),
    );

    expect(body.countryCode).toBe('IN');
    expect(body.items.map((item) => item.jobTitle)).toEqual([
      'Account Executive',
      'Software Engineer',
    ]);
  });

  it('returns nothing when a country HR user asks for another country', async () => {
    const query = { country: 'US' };
    expect(
      insightsSummarySchema.parse(await get('/api/insights/summary', indiaCookie, query)),
    ).toMatchObject({
      countryCode: 'US',
      headcount: 0,
      annualCost: { amountMinor: 0, currency: 'USD' },
      countries: [],
    });
    for (const path of ENDPOINTS.slice(1)) {
      const body = (await get(path, indiaCookie, query)) as { items: unknown[] };
      expect(body.items, path).toEqual([]);
    }
  });
});
