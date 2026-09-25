import {
  convertMinor,
  insightsSummarySchema,
  monthlyEquivalentMinor,
  payRangeByCountryResponseSchema,
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
const cad = (amountMinor: number) => ({ amountMinor, currency: 'CAD' });
const toUsd = (amountMinor: number, from: CurrencyCode) =>
  convertMinor(amountMinor, from, 'USD', TEST_RATES);

describe('dashboard summary and pay range per country', () => {
  let cookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    await insertInsightsData(db);
    cookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
  });

  async function get(path: string, query: Record<string, string> = {}) {
    const { app } = await createTestApp();
    const response = await request(app).get(path).query(query).set('Cookie', cookie);
    expect(response.status).toBe(200);
    return response.body as unknown;
  }

  async function summary(query: Record<string, string> = {}) {
    return insightsSummarySchema.parse(await get('/api/insights/summary', query));
  }

  async function payRange(query: Record<string, string> = {}) {
    return payRangeByCountryResponseSchema.parse(
      await get('/api/insights/pay-range-by-country', query),
    );
  }

  describe('GET /api/insights/summary', () => {
    it('gives org-wide totals in US dollars and each country in its own currency', async () => {
      const body = await summary();

      const indiaAnnual = 1_185_000_002;
      const annualUsd = toUsd(indiaAnnual, 'INR') + 72_500_000 + toUsd(9_000_000, 'CAD');
      expect(body).toEqual({
        measure: 'total',
        currency: 'local',
        rateDate: '2026-09-24',
        countryCode: null,
        headcount: 16,
        withoutPay: 1,
        annualCost: usd(annualUsd),
        monthlyCost: usd(monthlyEquivalentMinor(annualUsd)),
        countries: [
          {
            countryCode: 'CA',
            headcount: 1,
            annualCost: cad(9_000_000),
            monthlyCost: cad(750_000),
          },
          {
            countryCode: 'IN',
            headcount: 9,
            // 1,185,000,002 / 12 = 98,750,000.17
            annualCost: inr(indiaAnnual),
            monthlyCost: inr(98_750_000),
          },
          {
            countryCode: 'US',
            headcount: 6,
            // 72,500,000 / 12 = 6,041,666.67
            annualCost: usd(72_500_000),
            monthlyCost: usd(6_041_667),
          },
        ],
      });
    });

    it('converts each country to US dollars when asked', async () => {
      const body = await summary({ currency: 'USD' });

      expect(body.currency).toBe('USD');
      expect(body.countries.map((country) => country.annualCost)).toEqual([
        usd(toUsd(9_000_000, 'CAD')),
        usd(toUsd(1_185_000_002, 'INR')),
        usd(72_500_000),
      ]);
    });

    it('shows one country in its own currency, without needing exchange rates', async () => {
      const body = await summary({ country: 'IN' });

      expect(body).toMatchObject({
        countryCode: 'IN',
        rateDate: null,
        headcount: 9,
        withoutPay: 1,
        annualCost: inr(1_185_000_002),
        monthlyCost: inr(98_750_000),
      });
      expect(body.countries.map((country) => country.countryCode)).toEqual(['IN']);
    });

    it('shows one country in US dollars when asked', async () => {
      const body = await summary({ country: 'IN', currency: 'USD' });

      expect(body).toMatchObject({
        rateDate: '2026-09-24',
        annualCost: usd(toUsd(1_185_000_002, 'INR')),
      });
    });

    it('counts gross pay only, without employer contributions', async () => {
      const body = await summary({ country: 'IN', measure: 'gross' });

      expect(body).toMatchObject({ measure: 'gross', annualCost: inr(1_180_000_002) });
    });

    it('includes inactive employees only when asked', async () => {
      const body = await summary({ country: 'IN', includeInactive: 'true' });

      expect(body).toMatchObject({ headcount: 10, annualCost: inr(2_085_000_002) });
    });
  });

  describe('GET /api/insights/pay-range-by-country', () => {
    it('gives the range, quartiles, median and average of pay with pay per country', async () => {
      const body = await payRange();

      expect(body).toEqual({
        measure: 'total',
        currency: 'local',
        rateDate: null,
        items: [
          {
            countryCode: 'CA',
            headcount: 1,
            minimum: cad(9_000_000),
            lowerQuartile: cad(9_000_000),
            median: cad(9_000_000),
            upperQuartile: cad(9_000_000),
            maximum: cad(9_000_000),
            average: cad(9_000_000),
          },
          {
            // 80,000,000 105,000,000 110,000,001 120,000,000 130,000,000 140,000,000
            // 200,000,000 300,000,001; the engineer without pay is left out.
            countryCode: 'IN',
            headcount: 8,
            minimum: inr(80_000_000),
            // 105,000,000 + 0.75 x 5,000,001 = 108,750,000.75
            lowerQuartile: inr(108_750_001),
            median: inr(125_000_000),
            // 140,000,000 + 0.25 x 60,000,000
            upperQuartile: inr(155_000_000),
            maximum: inr(300_000_001),
            // 1,185,000,002 / 8 = 148,125,000.25
            average: inr(148_125_000),
          },
          {
            // 9,500,000 12,000,000 12,000,000 12,000,000 12,000,000 15,000,000
            countryCode: 'US',
            headcount: 6,
            minimum: usd(9_500_000),
            lowerQuartile: usd(12_000_000),
            median: usd(12_000_000),
            upperQuartile: usd(12_000_000),
            maximum: usd(15_000_000),
            // 72,500,000 / 6 = 12,083,333.33
            average: usd(12_083_333),
          },
        ],
      });
    });

    it('rounds quartiles and averages to whole minor units', async () => {
      // Gross pay in India: 80,000,000 100,000,000 110,000,001 ... so the lower quartile is
      // 100,000,000 + 0.75 x 10,000,001 = 107,500,000.75 and the average 1,180,000,002 / 8 is
      // 147,500,000.25. With the inactive engineer (nine people) the median is 130,000,000.
      const gross = await payRange({ country: 'IN', measure: 'gross' });
      expect(gross.items[0]).toMatchObject({
        lowerQuartile: inr(107_500_001),
        average: inr(147_500_000),
      });

      const withInactive = await payRange({ country: 'IN', includeInactive: 'true' });
      expect(withInactive.items[0]).toMatchObject({
        headcount: 9,
        median: inr(130_000_000),
        maximum: inr(900_000_000),
        // 2,085,000,002 / 9 = 231,666,666.89
        average: inr(231_666_667),
      });
    });

    it('converts every figure to US dollars when asked', async () => {
      const body = await payRange({ country: 'IN', currency: 'USD' });

      expect(body.rateDate).toBe('2026-09-24');
      expect(body.items).toEqual([
        {
          countryCode: 'IN',
          headcount: 8,
          minimum: usd(toUsd(80_000_000, 'INR')),
          lowerQuartile: usd(toUsd(108_750_001, 'INR')),
          median: usd(toUsd(125_000_000, 'INR')),
          upperQuartile: usd(toUsd(155_000_000, 'INR')),
          maximum: usd(toUsd(300_000_001, 'INR')),
          average: usd(toUsd(148_125_000, 'INR')),
        },
      ]);
    });

    it('rejects unknown measures', async () => {
      const { app } = await createTestApp();
      const response = await request(app)
        .get('/api/insights/pay-range-by-country')
        .query({ measure: 'base' })
        .set('Cookie', cookie);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ errors: [{ field: 'measure' }] });
    });
  });
});
