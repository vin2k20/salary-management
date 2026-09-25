import type { CountryCode, CurrencyCode, InsightsQuery } from '@salary/shared';
import { sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { employees } from '../../db/schema.ts';
import { scopeCondition, type Scope } from '../auth/scope.ts';

/**
 * Dashboard statistics, worked out in SQL over pay_totals_on(today). Every amount leaves the
 * database as an exact integer in minor units, as text: sums, minimums and maximums as they are,
 * and quartiles multiplied by four (the median by two), which are always whole numbers because
 * percentile_cont only interpolates at quarter points. The service divides once, rounding half to
 * even, so no floating point figure ever reaches the screen.
 */

/** Which annual amount to measure, from the pay_totals_on columns. */
const MEASURE_COLUMNS: Record<InsightsQuery['measure'], SQL> = {
  total: sql`totals.annual_total_minor`,
  gross: sql`totals.annual_gross_minor`,
};

export interface Filters {
  scope: Scope;
  country?: CountryCode | undefined;
  measure: InsightsQuery['measure'];
  includeInactive: boolean;
}

/**
 * The employees in view with the measured annual pay: always within the caller's scope, active
 * only unless inactive employees are included, and in one country when one is chosen. Employees
 * with no current pay are kept (pay 0) so they count in headcounts; statistics leave them out.
 */
function measured(filters: Filters, today: string): SQL {
  const conditions: SQL[] = [];
  const inScope = scopeCondition(filters.scope, employees.countryCode);
  if (inScope) conditions.push(inScope);
  if (!filters.includeInactive) conditions.push(sql`${employees.status} = 'active'`);
  if (filters.country) conditions.push(sql`${employees.countryCode} = ${filters.country}`);
  const where = conditions.length === 0 ? sql`` : sql`where ${sql.join(conditions, sql` and `)}`;
  return sql`measured as (
    select
      ${employees.id} as id,
      ${employees.employeeCode} as employee_code,
      ${employees.firstName} as first_name,
      ${employees.lastName} as last_name,
      ${employees.countryCode} as country_code,
      ${employees.jobTitle} as job_title,
      ${employees.department} as department,
      ${employees.employmentType} as employment_type,
      totals.currency_code,
      ${MEASURE_COLUMNS[filters.measure]} as pay_minor
    from ${employees}
    join pay_totals_on(${today}::date) as totals on totals.employee_id = ${employees.id}
    ${where}
  )`;
}

/** Both drivers return rows in `rows`; the shared database type leaves the result untyped. */
async function rowsOf<T>(db: Database, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return (result as { rows: T[] }).rows;
}

export interface CostRow {
  country_code: CountryCode;
  currency_code: CurrencyCode;
  headcount: number;
  without_pay: number;
  annual_minor: string;
}

/** Headcount, employees without pay and annual cost per country. */
export function costByCountry(db: Database, filters: Filters, today: string) {
  return rowsOf<CostRow>(
    db,
    sql`with ${measured(filters, today)}
    select
      country_code,
      currency_code,
      count(*)::int as headcount,
      (count(*) filter (where pay_minor = 0))::int as without_pay,
      sum(pay_minor)::text as annual_minor
    from measured
    group by country_code, currency_code
    order by country_code`,
  );
}

export interface PayRangeRow {
  country_code: CountryCode;
  currency_code: CurrencyCode;
  headcount: number;
  minimum_minor: string;
  maximum_minor: string;
  sum_minor: string;
  lower_quartile_x4: string;
  median_x4: string;
  upper_quartile_x4: string;
}

/** Quartiles times four: exact whole numbers, divided by four in the service. */
function quartileTimesFour(fraction: string): SQL {
  return sql`(percentile_cont(${sql.raw(fraction)}) within group (order by pay_minor) * 4)::bigint::text`;
}

/** Minimum, quartiles, maximum and total of pay per country, for employees with pay. */
export function payRangeByCountry(db: Database, filters: Filters, today: string) {
  return rowsOf<PayRangeRow>(
    db,
    sql`with ${measured(filters, today)}
    select
      country_code,
      currency_code,
      count(*)::int as headcount,
      min(pay_minor)::text as minimum_minor,
      max(pay_minor)::text as maximum_minor,
      sum(pay_minor)::text as sum_minor,
      ${quartileTimesFour('0.25')} as lower_quartile_x4,
      ${quartileTimesFour('0.5')} as median_x4,
      ${quartileTimesFour('0.75')} as upper_quartile_x4
    from measured
    where pay_minor > 0
    group by country_code, currency_code
    order by country_code`,
  );
}
