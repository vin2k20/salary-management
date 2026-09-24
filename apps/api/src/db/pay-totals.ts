import { monthlyEquivalentMinor, type CurrencyCode } from '@salary/shared';
import { sql } from 'drizzle-orm';
import type { Database } from './client.ts';

export interface PayTotals {
  employeeId: string;
  currencyCode: CurrencyCode;
  annualTotalMinor: number;
  annualGrossMinor: number;
  monthlyTotalMinor: number;
  monthlyGrossMinor: number;
}

interface PayTotalsRow {
  employee_id: string;
  currency_code: CurrencyCode;
  // bigint columns arrive as strings from both PostgreSQL drivers.
  annual_total_minor: string | number;
  annual_gross_minor: string | number;
}

/** Pay totals for every employee on a date (YYYY-MM-DD), from the pay_totals_on function. */
export async function payTotalsOn(db: Database, date: string): Promise<PayTotals[]> {
  const result = await db.execute(sql`select * from pay_totals_on(${date}::date)`);
  // Both drivers return the rows in `rows`; the shared database type leaves the result untyped.
  const { rows } = result as { rows: PayTotalsRow[] };
  return rows.map((row) => {
    const annualTotalMinor = Number(row.annual_total_minor);
    const annualGrossMinor = Number(row.annual_gross_minor);
    return {
      employeeId: row.employee_id,
      currencyCode: row.currency_code,
      annualTotalMinor,
      annualGrossMinor,
      monthlyTotalMinor: monthlyEquivalentMinor(annualTotalMinor),
      monthlyGrossMinor: monthlyEquivalentMinor(annualGrossMinor),
    };
  });
}
