import type { CurrencyCode } from '@salary/shared';
import { count, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import {
  changeLog,
  employees,
  fxRates,
  payChanges,
  payComponents,
  payItems,
} from '../db/schema.ts';
import { generateEmployees, type SeedOptions } from './employees.ts';
import { generatePay } from './pay.ts';

/** The standard data set: 10,000 employees generated for a fixed date with a fixed seed. */
export const DEFAULT_SEED_OPTIONS: SeedOptions = {
  count: 10_000,
  seed: 20_260_924,
  referenceDate: '2026-09-01',
};

/** Approximate units per US dollar in September 2026, until the daily refresh stores real rates. */
export const SEED_FX_RATES: Record<CurrencyCode, string> = {
  USD: '1',
  CAD: '1.38',
  AUD: '1.52',
  INR: '88.20',
};

export interface SeedDatabaseOptions extends SeedOptions {
  /** Delete seeded employees, pay and seed exchange rates first. Reference data is kept. */
  reset?: boolean;
  /** Rows per INSERT statement. */
  batchSize?: number;
}

export interface SeedSummary {
  employees: number;
  payChanges: number;
  payItems: number;
  fxRates: number;
}

/**
 * Loads generated employees, pay history and starting exchange rates in one transaction, so a
 * failed run leaves the database unchanged. Seeding is a bulk load, not a change made by a user,
 * so it writes no change log entries.
 */
export async function seedDatabase(
  db: Database,
  { reset = false, batchSize = 2_000, ...options }: SeedDatabaseOptions,
): Promise<SeedSummary> {
  const seedEmployees = generateEmployees(options);
  const pay = generatePay(seedEmployees, options);

  return db.transaction(async (tx) => {
    if (reset) {
      await tx.delete(changeLog).where(inArray(changeLog.entityType, ['employee', 'pay_change']));
      // TRUNCATE empties the tables at once, far faster than deleting rows one by one.
      await tx.execute(sql`truncate table ${payItems}, ${payChanges}, ${employees}`);
      await tx.delete(fxRates).where(eq(fxRates.source, 'seed'));
    } else {
      const [existing] = await tx.select({ value: count() }).from(employees);
      if ((existing?.value ?? 0) > 0) {
        throw new Error('The database already has employees; run with --reset to replace them');
      }
    }

    const components = await tx
      .select({
        id: payComponents.id,
        code: payComponents.code,
        countryCode: payComponents.countryCode,
      })
      .from(payComponents);
    const componentIds = new Map(
      components.map((component) => [
        `${component.code}/${component.countryCode ?? '*'}`,
        component.id,
      ]),
    );

    for (const batch of batches(seedEmployees, batchSize)) {
      await tx.insert(employees).values(batch.map(({ payFactor, ...employee }) => employee));
    }
    for (const batch of batches(pay.payChanges, batchSize)) {
      await tx.insert(payChanges).values(batch);
    }
    for (const batch of batches(pay.payItems, batchSize)) {
      await tx.insert(payItems).values(
        batch.map(({ componentCode, componentCountry, ...item }) => {
          const componentId = componentIds.get(`${componentCode}/${componentCountry ?? '*'}`);
          if (!componentId) {
            throw new Error(
              `Pay component ${componentCode} is missing for ${String(componentCountry)}`,
            );
          }
          return { ...item, componentId };
        }),
      );
    }

    const rates = Object.entries(SEED_FX_RATES).map(([currencyCode, unitsPerUsd]) => ({
      currencyCode,
      rateDate: options.referenceDate,
      unitsPerUsd,
      source: 'seed',
    }));
    await tx.insert(fxRates).values(rates).onConflictDoNothing();

    return {
      employees: seedEmployees.length,
      payChanges: pay.payChanges.length,
      payItems: pay.payItems.length,
      fxRates: rates.length,
    };
  });
}

function* batches<T>(rows: T[], size: number): Generator<T[]> {
  for (let start = 0; start < rows.length; start += size) {
    yield rows.slice(start, start + size);
  }
}
