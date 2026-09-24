import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database.ts';
import { fxRates } from './schema.ts';

describe('exchange rates table', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  const rate = { currencyCode: 'INR', unitsPerUsd: '88.12345678', source: 'test' };

  it('keeps the rate as an exact decimal', async () => {
    const [row] = await database.db
      .insert(fxRates)
      .values({ ...rate, rateDate: '2026-09-01' })
      .returning();

    expect(row?.unitsPerUsd).toBe('88.12345678');
  });

  it('keeps one rate per currency and date', async () => {
    await database.db.insert(fxRates).values({ ...rate, rateDate: '2026-09-02' });
    await expect(
      database.db.insert(fxRates).values({ ...rate, rateDate: '2026-09-02' }),
    ).rejects.toThrow();
  });

  it('rejects a rate that is not positive', async () => {
    await expect(
      database.db.insert(fxRates).values({ ...rate, rateDate: '2026-09-03', unitsPerUsd: '0' }),
    ).rejects.toThrow();
  });
});
