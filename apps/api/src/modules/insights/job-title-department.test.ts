import {
  convertMinor,
  costByDepartmentResponseSchema,
  monthlyEquivalentMinor,
  payByJobTitleResponseSchema,
  type CurrencyCode,
} from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { TEST_RATES, insertInsightsData } from '../../test/insights-data.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

const inr = (amountMinor: number) => ({ amountMinor, currency: 'INR' });
const usd = (amountMinor: number) => ({ amountMinor, currency: 'USD' });
const toUsd = (amountMinor: number, from: CurrencyCode) =>
  convertMinor(amountMinor, from, 'USD', TEST_RATES);

describe('dashboard pay by job title and cost by department', () => {
  let cookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    await insertInsightsData(db);
    cookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
  });

  async function get(path: string, query: Record<string, string>) {
    const { app } = await createTestApp();
    return request(app).get(path).query(query).set('Cookie', cookie);
  }

  async function byJobTitle(query: Record<string, string>) {
    const response = await get('/api/insights/by-job-title', query);
    expect(response.status).toBe(200);
    return payByJobTitleResponseSchema.parse(response.body);
  }

  async function byDepartment(query: Record<string, string> = {}) {
    const response = await get('/api/insights/cost-by-department', query);
    expect(response.status).toBe(200);
    return costByDepartmentResponseSchema.parse(response.body);
  }

  describe('GET /api/insights/by-job-title', () => {
    it('gives headcount, average, median and range per job title in a country', async () => {
      const body = await byJobTitle({ country: 'IN' });

      expect(body).toEqual({
        measure: 'total',
        currency: 'local',
        rateDate: null,
        countryCode: 'IN',
        items: [
          {
            // 80,000,000 and 300,000,001: the average and median are 190,000,000.5, which
            // rounds to the even 190,000,000.
            jobTitle: 'Account Executive',
            headcount: 2,
            average: inr(190_000_000),
            median: inr(190_000_000),
            minimum: inr(80_000_000),
            maximum: inr(300_000_001),
          },
          {
            // Six engineers with pay (the one without pay is left out): 805,000,001 / 6 is
            // 134,166,666.83, and the median is (120,000,000 + 130,000,000) / 2.
            jobTitle: 'Software Engineer',
            headcount: 6,
            average: inr(134_166_667),
            median: inr(125_000_000),
            minimum: inr(105_000_000),
            maximum: inr(200_000_000),
          },
        ],
      });
    });

    it('follows the measure, the currency and the inactive option', async () => {
      const gross = await byJobTitle({ country: 'IN', measure: 'gross' });
      expect(gross.items[1]).toMatchObject({ minimum: inr(100_000_000) });

      const inUsd = await byJobTitle({ country: 'US', currency: 'USD' });
      expect(inUsd).toMatchObject({ rateDate: '2026-09-24', countryCode: 'US' });
      expect(inUsd.items[1]).toEqual({
        jobTitle: 'Software Engineer',
        headcount: 5,
        average: usd(12_100_000),
        median: usd(12_000_000),
        minimum: usd(9_500_000),
        maximum: usd(15_000_000),
      });

      const withInactive = await byJobTitle({ country: 'IN', includeInactive: 'true' });
      expect(withInactive.items[1]).toMatchObject({
        headcount: 7,
        median: inr(130_000_000),
        maximum: inr(900_000_000),
      });
    });

    it('converts Indian figures to US dollars', async () => {
      const body = await byJobTitle({ country: 'IN', currency: 'USD' });

      expect(body.items[0]).toMatchObject({
        average: usd(toUsd(190_000_000, 'INR')),
        maximum: usd(toUsd(300_000_001, 'INR')),
      });
    });

    it('asks global HR users to choose a country', async () => {
      const response = await get('/api/insights/by-job-title', {});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        errors: [{ field: 'country', message: 'Choose a country to compare job titles' }],
      });
    });
  });

  describe('GET /api/insights/cost-by-department', () => {
    it('gives monthly and annual cost per department in a country, largest first', async () => {
      const body = await byDepartment({ country: 'IN' });

      expect(body).toEqual({
        measure: 'total',
        currency: 'local',
        rateDate: null,
        countryCode: 'IN',
        items: [
          {
            // Seven engineers, one of them without pay; 805,000,001 / 12 = 67,083,333.42
            department: 'Engineering',
            headcount: 7,
            annualCost: inr(805_000_001),
            monthlyCost: inr(67_083_333),
          },
          {
            // 380,000,001 / 12 = 31,666,666.75
            department: 'Sales',
            headcount: 2,
            annualCost: inr(380_000_001),
            monthlyCost: inr(31_666_667),
          },
        ],
      });
    });

    it('adds up every country in US dollars on the all-countries view', async () => {
      const body = await byDepartment();

      const engineering = toUsd(805_000_001, 'INR') + 60_500_000 + toUsd(9_000_000, 'CAD');
      const sales = toUsd(380_000_001, 'INR') + 12_000_000;
      expect(body).toEqual({
        measure: 'total',
        currency: 'local',
        rateDate: '2026-09-24',
        countryCode: null,
        items: [
          {
            department: 'Engineering',
            headcount: 13,
            annualCost: usd(engineering),
            monthlyCost: usd(monthlyEquivalentMinor(engineering)),
          },
          {
            department: 'Sales',
            headcount: 3,
            annualCost: usd(sales),
            monthlyCost: usd(monthlyEquivalentMinor(sales)),
          },
        ],
      });
    });

    it('follows the currency toggle on a country view', async () => {
      const body = await byDepartment({ country: 'IN', currency: 'USD', measure: 'gross' });

      expect(body.items[0]).toMatchObject({
        annualCost: usd(toUsd(800_000_001, 'INR')),
      });
    });
  });
});
