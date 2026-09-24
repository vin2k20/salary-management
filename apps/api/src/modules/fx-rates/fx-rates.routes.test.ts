import { fxRatesResponseSchema, fxRefreshResponseSchema } from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import {
  TEST_RATES_SECRET,
  createTestApp,
  fixedRateProvider,
  sharedTestDatabase,
  testClock,
} from '../../test/test-app.ts';
import type { RateProvider } from './frankfurter-client.ts';

const failingProvider: RateProvider = {
  latestUsdRates: () => Promise.reject(new Error('fetch failed')),
};

describe('exchange rate endpoints', () => {
  let globalUser: Awaited<ReturnType<typeof insertUser>>;
  let globalCookie: string;
  let countryCookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    globalUser = await insertUser(db, { role: 'global_hr' });
    globalCookie = await sessionCookieFor(globalUser);
    countryCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'AU' }),
    );
  });

  describe('GET /api/fx-rates/latest', () => {
    it('gives any signed-in user the latest rates and their date', async () => {
      const { app } = await createTestApp();
      await request(app).post('/api/fx-rates/refresh').set('Cookie', globalCookie);

      const response = await request(app).get('/api/fx-rates/latest').set('Cookie', countryCookie);

      expect(response.status).toBe(200);
      expect(fxRatesResponseSchema.parse(response.body)).toMatchObject({
        rateDate: '2026-09-24',
        rates: { USD: '1', INR: '95.96' },
      });
    });

    it('needs a session', async () => {
      const { app } = await createTestApp();

      expect((await request(app).get('/api/fx-rates/latest')).status).toBe(401);
    });
  });

  describe('POST /api/fx-rates/refresh', () => {
    it('lets a global HR user refresh by hand', async () => {
      const clock = testClock('2026-09-25T10:00:00Z');
      const { app } = await createTestApp({ clock, rateProvider: fixedRateProvider('2026-09-25') });

      const response = await request(app)
        .post('/api/fx-rates/refresh')
        .set('Cookie', await sessionCookieFor(globalUser, { clock }));

      expect(response.status).toBe(200);
      expect(fxRefreshResponseSchema.parse(response.body)).toMatchObject({
        rateDate: '2026-09-25',
        stored: 4,
      });
    });

    it('refuses country HR users', async () => {
      const { app } = await createTestApp();

      const response = await request(app)
        .post('/api/fx-rates/refresh')
        .set('Cookie', countryCookie);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        detail: 'Only global HR users can refresh exchange rates',
      });
    });

    it('answers 502 and logs the error when the rate service fails', async () => {
      const { app, logLines } = await createTestApp({ rateProvider: failingProvider });

      const response = await request(app).post('/api/fx-rates/refresh').set('Cookie', globalCookie);

      expect(response.status).toBe(502);
      expect(response.body).toMatchObject({
        detail: 'The exchange rate service is not available. Try again later.',
      });
      expect(logLines).toContainEqual(
        expect.objectContaining({ msg: 'Exchange rate refresh failed' }),
      );
    });
  });

  describe('POST /api/internal/fx-rates/refresh', () => {
    it('refreshes with the shared secret and no session', async () => {
      const { app } = await createTestApp({ rateProvider: fixedRateProvider('2026-09-26') });

      const response = await request(app)
        .post('/api/internal/fx-rates/refresh')
        .set('Authorization', `Bearer ${TEST_RATES_SECRET}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ rateDate: '2026-09-26', stored: 4 });
    });

    it.each([
      ['no secret', undefined],
      ['a wrong secret', 'Bearer not-the-secret'],
      ['the secret without the Bearer prefix', TEST_RATES_SECRET],
    ])('refuses %s with 401', async (_case, header) => {
      const { app } = await createTestApp();
      const call = request(app).post('/api/internal/fx-rates/refresh');

      const response = await (header ? call.set('Authorization', header) : call);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ detail: 'A valid refresh secret is required' });
    });

    it('is switched off when no secret is configured', async () => {
      const { app } = await createTestApp({ ratesRefreshSecret: null });

      const response = await request(app)
        .post('/api/internal/fx-rates/refresh')
        .set('Authorization', 'Bearer anything');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ detail: 'The scheduled refresh is not set up' });
    });
  });
});
