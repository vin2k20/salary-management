import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fxRates } from '../../db/schema.ts';
import { testClock } from '../../test/test-app.ts';
import { createTestDatabase, type TestDatabase } from '../../test/test-database.ts';
import type { RateProvider } from './frankfurter-client.ts';
import { latestRates, refreshRates } from './fx-rates.service.ts';

function provider(
  date: string,
  rates = { CAD: '1.4117', AUD: '1.4232', INR: '95.96' },
): RateProvider {
  return { latestUsdRates: () => Promise.resolve({ date, rates }) };
}

describe('exchange rate refresh', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  it('stores one rate per currency for the provider date', async () => {
    const clock = testClock('2026-09-24T07:00:00Z');

    const result = await refreshRates(database.db, provider('2026-09-24'), clock);

    expect(result).toEqual({ rateDate: '2026-09-24', stored: 4 });
    const rows = await database.db.select().from(fxRates).where(eq(fxRates.rateDate, '2026-09-24'));
    expect(
      Object.fromEntries(rows.map((row) => [row.currencyCode, [row.unitsPerUsd, row.source]])),
    ).toEqual({
      USD: ['1.00000000', 'frankfurter'],
      CAD: ['1.41170000', 'frankfurter'],
      AUD: ['1.42320000', 'frankfurter'],
      INR: ['95.96000000', 'frankfurter'],
    });
    expect(rows[0]?.fetchedAt).toEqual(new Date('2026-09-24T07:00:00Z'));
  });

  it('ignores a repeat for a date it already has', async () => {
    const clock = testClock('2026-09-24T08:00:00Z');

    const result = await refreshRates(
      database.db,
      provider('2026-09-24', { CAD: '9', AUD: '9', INR: '9' }),
      clock,
    );

    expect(result).toEqual({ rateDate: '2026-09-24', stored: 0 });
    const [inr] = await database.db.select().from(fxRates).where(eq(fxRates.currencyCode, 'INR'));
    expect(inr?.unitsPerUsd).toBe('95.96000000');
  });

  it('keeps the history and reports the latest rates with their date', async () => {
    await refreshRates(
      database.db,
      provider('2026-09-25', { CAD: '1.4200', AUD: '1.4300', INR: '96.10' }),
      testClock('2026-09-25T07:00:00Z'),
    );

    expect(await latestRates(database.db, testClock('2026-09-26T09:00:00Z'))).toEqual({
      rateDate: '2026-09-25',
      rates: { USD: '1', CAD: '1.42', AUD: '1.43', INR: '96.1' },
      stale: false,
    });
    const rows = await database.db.select().from(fxRates);
    expect(rows).toHaveLength(8);
  });

  it('marks rates more than three days old as stale', async () => {
    const result = await latestRates(database.db, testClock('2026-09-29T09:00:00Z'));

    expect(result.stale).toBe(true);
  });

  it('reports no rates on an empty database', async () => {
    const empty = await createTestDatabase();

    expect(await latestRates(empty.db, testClock())).toEqual({
      rateDate: null,
      rates: {},
      stale: true,
    });
    await empty.close();
  });
});
