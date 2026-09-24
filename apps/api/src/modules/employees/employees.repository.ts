import type { EmployeeListQuery, EmployeeSortField } from '@salary/shared';
import { sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { employees, fxRates } from '../../db/schema.ts';
import { scopeCondition, type Scope } from '../auth/scope.ts';

export interface EmployeeListRow {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  job_title: string;
  department: string;
  country_code: string;
  region: string;
  employment_type: string;
  status: string;
  currency_code: string;
  // bigint arrives as a string from both PostgreSQL drivers.
  annual_total_minor: string | number;
}

/** Escapes LIKE wildcards so a search for "100%" finds the text, not everything. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Filters shared by the page query and the count, always limited to the caller's scope. */
function whereClause(scope: Scope, query: EmployeeListQuery): SQL {
  const conditions: SQL[] = [];
  const inScope = scopeCondition(scope, employees.countryCode);
  if (inScope) conditions.push(inScope);
  if (!query.includeInactive) conditions.push(sql`${employees.status} = 'active'`);
  if (query.country) conditions.push(sql`${employees.countryCode} = ${query.country}`);
  if (query.region) conditions.push(sql`${employees.region} = ${query.region}`);
  if (query.department) conditions.push(sql`${employees.department} = ${query.department}`);
  if (query.jobTitle) conditions.push(sql`${employees.jobTitle} = ${query.jobTitle}`);
  if (query.employmentType) {
    conditions.push(sql`${employees.employmentType} = ${query.employmentType}`);
  }
  if (query.search) {
    const term = escapeLike(query.search);
    // The name expression matches the trigram index, so partial search stays fast.
    conditions.push(
      sql`((${employees.firstName} || ' ' || ${employees.lastName}) ilike ${`%${term}%`}
        or ${employees.employeeCode} ilike ${`${term}%`})`,
    );
  }
  return conditions.length === 0 ? sql`` : sql`where ${sql.join(conditions, sql` and `)}`;
}

const sortColumns: Record<EmployeeSortField, SQL> = {
  name: sql`${employees.lastName}, ${employees.firstName}`,
  employeeCode: sql`${employees.employeeCode}`,
  jobTitle: sql`${employees.jobTitle}`,
  department: sql`${employees.department}`,
  country: sql`${employees.countryCode}`,
  hireDate: sql`${employees.hireDate}`,
  // Compared in US dollars, so the order makes sense across countries.
  annualTotal: sql`annual_usd`,
};

function orderBy(sort: string): SQL {
  const descending = sort.startsWith('-');
  const field = (descending ? sort.slice(1) : sort) as EmployeeSortField;
  const direction = sql.raw(descending ? 'desc' : 'asc');
  const columns =
    field === 'name'
      ? [sql`${employees.lastName}`, sql`${employees.firstName}`]
      : [sortColumns[field]];
  // The employee code breaks ties, so paging never repeats or skips a row.
  return sql`${sql.join(
    columns.map((column) => sql`${column} ${direction} nulls last`),
    sql`, `,
  )}, ${employees.employeeCode} asc`;
}

/**
 * One page of employees with their annual total on `today`, plus the number of matches. The
 * annual total in US dollars is worked out only to sort; amounts are converted exactly later.
 */
export async function listEmployees(
  db: Database,
  scope: Scope,
  query: EmployeeListQuery,
  today: string,
): Promise<{ rows: EmployeeListRow[]; total: number }> {
  const where = whereClause(scope, query);
  // The page and the count are independent, so they run at the same time.
  const [page, count] = await Promise.all([
    db.execute(sql`
    with latest_rates as (
      select distinct on (${fxRates.currencyCode})
        ${fxRates.currencyCode} as currency_code, ${fxRates.unitsPerUsd} as units_per_usd
      from ${fxRates}
      where ${fxRates.rateDate} <= ${today}
      order by ${fxRates.currencyCode}, ${fxRates.rateDate} desc
    )
    select
      ${employees.id} as id,
      ${employees.employeeCode} as employee_code,
      ${employees.firstName} as first_name,
      ${employees.lastName} as last_name,
      ${employees.jobTitle} as job_title,
      ${employees.department} as department,
      ${employees.countryCode} as country_code,
      ${employees.region} as region,
      ${employees.employmentType} as employment_type,
      ${employees.status} as status,
      totals.currency_code,
      totals.annual_total_minor,
      totals.annual_total_minor / latest_rates.units_per_usd as annual_usd
    from ${employees}
    join pay_totals_on(${today}::date) as totals on totals.employee_id = ${employees.id}
    left join latest_rates on latest_rates.currency_code = totals.currency_code
    ${where}
    order by ${orderBy(query.sort)}
    limit ${query.pageSize} offset ${(query.page - 1) * query.pageSize}
  `),
    db.execute(sql`select count(*)::int as total from ${employees} ${where}`),
  ]);

  // Both drivers return rows in `rows`; the shared database type leaves the result untyped.
  const { rows } = page as { rows: EmployeeListRow[] };
  const [counted] = (count as { rows: { total: number }[] }).rows;
  return { rows, total: counted?.total ?? 0 };
}
