import {
  convertMinor,
  monthlyEquivalentMinor,
  type CountryCode,
  type CurrencyCode,
  type EmployeeListQuery,
  type EmployeeListResponse,
  type EmploymentType,
  type EmployeeStatus,
} from '@salary/shared';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import type { Scope } from '../auth/scope.ts';
import { latestRates } from '../fx-rates/fx-rates.service.ts';
import { listEmployees } from './employees.repository.ts';

/**
 * The employee directory: one page of employees in the caller's scope with their annual total
 * and monthly equivalent, in local currency or converted to US dollars with the latest rates.
 */
export async function employeeDirectory(
  db: Database,
  scope: Scope,
  query: EmployeeListQuery,
  clock: Clock,
): Promise<EmployeeListResponse> {
  const today = clock.now().toISOString().slice(0, 10);
  const [{ rows, total }, rates] = await Promise.all([
    listEmployees(db, scope, query, today),
    query.currency === 'USD' ? latestRates(db, clock) : null,
  ]);

  const items = rows.map((row) => {
    const localCurrency = row.currency_code as CurrencyCode;
    const localAnnual = Number(row.annual_total_minor);
    let currency = localCurrency;
    let annual = localAnnual;
    if (rates) {
      if (rates.rates[localCurrency] === undefined || rates.rates.USD === undefined) {
        throw new HttpError(503, 'Exchange rates are not available yet. Try again later.');
      }
      currency = 'USD';
      annual = convertMinor(localAnnual, localCurrency, 'USD', rates.rates);
    }
    return {
      id: row.id,
      employeeCode: row.employee_code,
      firstName: row.first_name,
      lastName: row.last_name,
      jobTitle: row.job_title,
      department: row.department,
      countryCode: row.country_code as CountryCode,
      region: row.region,
      employmentType: row.employment_type as EmploymentType,
      status: row.status as EmployeeStatus,
      annualTotal: { amountMinor: annual, currency },
      monthlyTotal: { amountMinor: monthlyEquivalentMinor(annual), currency },
    };
  });

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    currency: query.currency,
    rateDate: rates?.rateDate ?? null,
  };
}
