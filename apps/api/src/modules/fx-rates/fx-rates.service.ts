import { isStale, type CurrencyCode, type FxRatesResponse } from '@salary/shared';
import { asc, desc, lte } from 'drizzle-orm';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { fxRates } from '../../db/schema.ts';
import type { RateProvider } from './frankfurter-client.ts';

/** "95.96000000" from the numeric column becomes "95.96"; "1.00000000" becomes "1". */
function trimRate(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}

function today(clock: Clock): string {
  return clock.now().toISOString().slice(0, 10);
}

/**
 * Fetches the latest rates and stores one row per currency for their date. A date already stored
 * is left as it is, so repeated runs (weekends, retries) change nothing.
 */
export async function refreshRates(
  db: Database,
  provider: RateProvider,
  clock: Clock,
): Promise<{ rateDate: string; stored: number }> {
  const { date, rates } = await provider.latestUsdRates();
  const fetchedAt = clock.now();
  const rows = [
    { currencyCode: 'USD', unitsPerUsd: '1' },
    ...Object.entries(rates).map(([currencyCode, unitsPerUsd]) => ({ currencyCode, unitsPerUsd })),
  ].map((row) => ({ ...row, rateDate: date, source: 'frankfurter', fetchedAt }));

  const stored = await db
    .insert(fxRates)
    .values(rows)
    .onConflictDoNothing()
    .returning({ currencyCode: fxRates.currencyCode });
  return { rateDate: date, stored: stored.length };
}

/** The latest rate on or before today for each currency, and whether they are out of date. */
export async function latestRates(db: Database, clock: Clock): Promise<FxRatesResponse> {
  const rows = await db
    .selectDistinctOn([fxRates.currencyCode], {
      currencyCode: fxRates.currencyCode,
      rateDate: fxRates.rateDate,
      unitsPerUsd: fxRates.unitsPerUsd,
    })
    .from(fxRates)
    .where(lte(fxRates.rateDate, today(clock)))
    .orderBy(asc(fxRates.currencyCode), desc(fxRates.rateDate));

  const rateDate = rows.reduce<string | null>(
    (oldest, row) => (oldest === null || row.rateDate < oldest ? row.rateDate : oldest),
    null,
  );
  return {
    rateDate,
    rates: Object.fromEntries(
      rows.map((row) => [row.currencyCode as CurrencyCode, trimRate(row.unitsPerUsd)]),
    ),
    stale: isStale(rateDate, today(clock)),
  };
}
