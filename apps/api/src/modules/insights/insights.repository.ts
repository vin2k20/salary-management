import {
  PEER_COMPARISON,
  type CountryCode,
  type CurrencyCode,
  type EmploymentType,
  type InsightsQuery,
  type OutliersQuery,
} from '@salary/shared';
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

export interface JobTitleRow {
  job_title: string;
  currency_code: CurrencyCode;
  headcount: number;
  minimum_minor: string;
  maximum_minor: string;
  sum_minor: string;
  median_x4: string;
}

/** Pay per job title for employees with pay; the filters name one country. */
export function payByJobTitle(db: Database, filters: Filters, today: string) {
  return rowsOf<JobTitleRow>(
    db,
    sql`with ${measured(filters, today)}
    select
      job_title,
      currency_code,
      count(*)::int as headcount,
      min(pay_minor)::text as minimum_minor,
      max(pay_minor)::text as maximum_minor,
      sum(pay_minor)::text as sum_minor,
      ${quartileTimesFour('0.5')} as median_x4
    from measured
    where pay_minor > 0
    group by job_title, currency_code
    order by job_title`,
  );
}

export interface DepartmentRow {
  department: string;
  currency_code: CurrencyCode;
  headcount: number;
  annual_minor: string;
}

/**
 * Headcount and annual cost per department and currency; on a view of every country the service
 * converts each currency's part to US dollars and adds them up.
 */
export function costByDepartment(db: Database, filters: Filters, today: string) {
  return rowsOf<DepartmentRow>(
    db,
    sql`with ${measured(filters, today)}
    select
      department,
      currency_code,
      count(*)::int as headcount,
      sum(pay_minor)::text as annual_minor
    from measured
    group by department, currency_code
    order by department, currency_code`,
  );
}

export interface OutlierRow {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  country_code: CountryCode;
  job_title: string;
  employment_type: EmploymentType;
  currency_code: CurrencyCode;
  pay_minor: string;
  peer_median_minor: string;
  peer_count: number;
}

/**
 * Employees whose pay is more than the limit above or below their peer median (D32). Peers share
 * country, job title and employment type; one grouped query finds every peer median, and groups
 * smaller than the minimum are left out. The median is taken times two (a whole number) and
 * halved with halves to even: (m2 + 1) / 2 when m2 mod 4 is 3, else m2 / 2, in integer division.
 * The flag is the same exact inequality as comparePeerPay in the shared package.
 */
function flagged(filters: Filters, direction: OutliersQuery['direction'], today: string): SQL {
  const { limitPercent, minimumGroupSize } = PEER_COMPARISON;
  let side = sql``;
  if (direction === 'above') side = sql`and pay_minor > peer_median_minor`;
  if (direction === 'below') side = sql`and pay_minor < peer_median_minor`;
  return sql`with ${measured(filters, today)},
    paid as (select * from measured where pay_minor > 0),
    peers as (
      select
        country_code,
        job_title,
        employment_type,
        count(*)::int as peer_count,
        (percentile_cont(0.5) within group (order by pay_minor) * 2)::bigint as median_x2
      from paid
      group by country_code, job_title, employment_type
      having count(*) >= ${minimumGroupSize}
    ),
    compared as (
      select
        paid.*,
        peers.peer_count,
        (peers.median_x2 + case when peers.median_x2 % 4 = 3 then 1 else 0 end) / 2
          as peer_median_minor
      from paid
      join peers using (country_code, job_title, employment_type)
    ),
    flagged as (
      select * from compared
      where abs(pay_minor - peer_median_minor) * 100 > peer_median_minor * ${limitPercent}
      ${side}
    )`;
}

/** One page of outliers, largest relative difference first, and how many there are in all. */
export async function listOutliers(
  db: Database,
  filters: Filters,
  query: Pick<OutliersQuery, 'direction' | 'page' | 'pageSize'>,
  today: string,
): Promise<{ rows: OutlierRow[]; total: number }> {
  const cte = flagged(filters, query.direction, today);
  // The page and the count are independent, so they run at the same time.
  const [rows, counted] = await Promise.all([
    rowsOf<OutlierRow>(
      db,
      sql`${cte}
      select
        id, employee_code, first_name, last_name, country_code, job_title, employment_type,
        currency_code, pay_minor::text as pay_minor, peer_median_minor::text as peer_median_minor,
        peer_count
      from flagged
      order by abs(pay_minor - peer_median_minor)::numeric / peer_median_minor desc, employee_code
      limit ${query.pageSize} offset ${(query.page - 1) * query.pageSize}`,
    ),
    rowsOf<{ total: number }>(db, sql`${cte} select count(*)::int as total from flagged`),
  ]);
  return { rows, total: counted[0]?.total ?? 0 };
}
