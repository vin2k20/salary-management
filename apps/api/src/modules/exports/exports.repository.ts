import { and, asc, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { employees, payComponents, payItems } from '../../db/schema.ts';
import { scopeCondition, type Scope } from '../auth/scope.ts';
import { employeeConditions, type EmployeeFilters } from '../employees/employees.repository.ts';

/**
 * The next batch of employees matching the directory filters, by employee code, after the last
 * code of the previous batch. Reading in batches keeps memory flat for any number of rows.
 */
export function employeesAfter(
  db: Database,
  scope: Scope,
  filters: EmployeeFilters,
  afterCode: string | null,
  limit: number,
) {
  const conditions = employeeConditions(scope, filters);
  if (afterCode !== null) conditions.push(gt(employees.employeeCode, afterCode));
  return db
    .select()
    .from(employees)
    .where(and(...conditions))
    .orderBy(asc(employees.employeeCode))
    .limit(limit);
}

export type ExportEmployee = Awaited<ReturnType<typeof employeesAfter>>[number];

/** Pay items in force on a date for some employees, by employee code and component code. */
export function currentItemsFor(db: Database, scope: Scope, employeeIds: string[], date: string) {
  return db
    .select({
      employeeCode: employees.employeeCode,
      componentCode: payComponents.code,
      amountMinor: payItems.amountMinor,
      currency: payItems.currencyCode,
      frequency: payItems.frequencyCode,
      effectiveFrom: payItems.effectiveFrom,
    })
    .from(payItems)
    .innerJoin(employees, eq(employees.id, payItems.employeeId))
    .innerJoin(payComponents, eq(payComponents.id, payItems.componentId))
    .where(
      and(
        inArray(payItems.employeeId, employeeIds),
        scopeCondition(scope, employees.countryCode),
        lte(payItems.effectiveFrom, date),
        or(isNull(payItems.effectiveTo), gt(payItems.effectiveTo, date)),
      ),
    )
    .orderBy(asc(employees.employeeCode), asc(payComponents.code));
}
