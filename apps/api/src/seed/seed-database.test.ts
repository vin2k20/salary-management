import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { payTotalsOn } from '../db/pay-totals.ts';
import { employees, fxRates, payChanges, payComponents, payItems } from '../db/schema.ts';
import { createTestDatabase, type TestDatabase } from '../test/test-database.ts';
import { seedDatabase } from './seed-database.ts';

const options = { count: 200, seed: 20_260_924, referenceDate: '2026-09-01', batchSize: 50 };

describe('seedDatabase', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  async function countRows(table: typeof employees | typeof payChanges | typeof payItems) {
    const [row] = await database.db.select({ value: count() }).from(table);
    return row?.value ?? 0;
  }

  it('loads employees, pay history and starting exchange rates in batches', async () => {
    const summary = await seedDatabase(database.db, options);

    expect(summary.employees).toBe(200);
    expect(await countRows(employees)).toBe(200);
    expect(await countRows(payChanges)).toBe(summary.payChanges);
    expect(await countRows(payItems)).toBe(summary.payItems);
    expect(summary.payItems).toBeGreaterThan(summary.employees);

    const rates = await database.db
      .select({ currencyCode: fxRates.currencyCode, source: fxRates.source })
      .from(fxRates)
      .where(eq(fxRates.rateDate, options.referenceDate));
    expect(rates.map((rate) => rate.currencyCode).sort()).toEqual(['AUD', 'CAD', 'INR', 'USD']);
    expect(rates.every((rate) => rate.source === 'seed')).toBe(true);
  });

  it('gives every seeded employee current pay in the totals', async () => {
    const totals = await payTotalsOn(database.db, options.referenceDate);

    expect(totals).toHaveLength(200);
    expect(totals.every((row) => row.annualTotalMinor > 0)).toBe(true);
  });

  it('refuses to add to existing employees unless asked to reset', async () => {
    await expect(seedDatabase(database.db, options)).rejects.toThrow(/already has employees/);
  });

  it('replaces seeded data on reset and keeps the reference data', async () => {
    const [componentsBefore] = await database.db.select({ value: count() }).from(payComponents);

    const summary = await seedDatabase(database.db, { ...options, count: 120, reset: true });

    expect(summary.employees).toBe(120);
    expect(await countRows(employees)).toBe(120);
    expect(await countRows(payItems)).toBe(summary.payItems);
    const [componentsAfter] = await database.db.select({ value: count() }).from(payComponents);
    expect(componentsAfter?.value).toBe(componentsBefore?.value);
  });
});
