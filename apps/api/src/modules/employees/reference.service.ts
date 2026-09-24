import {
  EMPLOYMENT_TYPES,
  type CountryCode,
  type CurrencyCode,
  type ReferenceData,
} from '@salary/shared';
import { asc } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { countries, employees } from '../../db/schema.ts';
import { scopeCondition, type Scope } from '../auth/scope.ts';

/** Filter choices for the directory: countries in scope and the values used by its employees. */
export async function referenceData(db: Database, scope: Scope): Promise<ReferenceData> {
  const employeesInScope = scopeCondition(scope, employees.countryCode);
  const [countryRows, regionRows, departmentRows, jobTitleRows] = await Promise.all([
    db
      .select()
      .from(countries)
      .where(scopeCondition(scope, countries.code))
      .orderBy(asc(countries.code)),
    db
      .selectDistinct({ countryCode: employees.countryCode, name: employees.region })
      .from(employees)
      .where(employeesInScope)
      .orderBy(asc(employees.countryCode), asc(employees.region)),
    db
      .selectDistinct({ name: employees.department })
      .from(employees)
      .where(employeesInScope)
      .orderBy(asc(employees.department)),
    db
      .selectDistinct({ name: employees.jobTitle })
      .from(employees)
      .where(employeesInScope)
      .orderBy(asc(employees.jobTitle)),
  ]);

  return {
    countries: countryRows.map((row) => ({
      code: row.code as CountryCode,
      name: row.name,
      currencyCode: row.currencyCode as CurrencyCode,
    })),
    regions: regionRows.map((row) => ({
      countryCode: row.countryCode as CountryCode,
      name: row.name,
    })),
    departments: departmentRows.map((row) => row.name),
    jobTitles: jobTitleRows.map((row) => row.name),
    employmentTypes: [...EMPLOYMENT_TYPES],
  };
}
