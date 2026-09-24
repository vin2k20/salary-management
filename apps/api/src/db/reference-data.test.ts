import { COUNTRIES, CURRENCIES, PAY_FREQUENCIES } from '@salary/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database.ts';
import { countries, currencies, payFrequencies } from './schema.ts';

describe('reference data', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  it('has the currencies defined in the shared package', async () => {
    const rows = await database.db.select().from(currencies);
    expect(Object.fromEntries(rows.map((row) => [row.code, row]))).toEqual(
      Object.fromEntries(
        Object.entries(CURRENCIES).map(([code, currency]) => [code, { code, ...currency }]),
      ),
    );
  });

  it('has the four countries with their local currencies', async () => {
    const rows = await database.db.select().from(countries);
    expect(Object.fromEntries(rows.map((row) => [row.code, row]))).toEqual(
      Object.fromEntries(
        Object.entries(COUNTRIES).map(([code, country]) => [code, { code, ...country }]),
      ),
    );
  });

  it('has the eight pay frequencies defined in the shared package', async () => {
    const rows = await database.db.select().from(payFrequencies);
    expect(Object.fromEntries(rows.map((row) => [row.code, row]))).toEqual(
      Object.fromEntries(
        Object.entries(PAY_FREQUENCIES).map(([code, frequency]) => [code, { code, ...frequency }]),
      ),
    );
  });
});
