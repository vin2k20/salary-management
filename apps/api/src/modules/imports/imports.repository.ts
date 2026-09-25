import { and, eq, gt, isNull, lte, max, not, or, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { employees, payChanges, payComponents, payItems } from '../../db/schema.ts';
import { scopeCondition, type Scope } from '../auth/scope.ts';

/**
 * Bulk reads for an import, limited to the employees the file names: each read covers all of
 * them in one query instead of one query per row.
 */

/**
 * Employees with one of the codes. The codes go in as one array parameter, since a file can name
 * more employees than a query can have parameters.
 */
function withCode(codes: readonly string[]) {
  return sql`${employees.employeeCode} = any(${sql.param(codes)}::text[])`;
}

export function employeesInScope(db: Database, scope: Scope, codes: readonly string[]) {
  return db
    .select()
    .from(employees)
    .where(and(scopeCondition(scope, employees.countryCode), withCode(codes)));
}

/**
 * Codes of the file that belong to employees outside the caller's scope. A new employee cannot
 * take one of them, since codes are unique across all countries; only the codes are read.
 */
export async function codesOutsideScope(
  db: Database,
  scope: Scope,
  codes: readonly string[],
): Promise<string[]> {
  const inScope = scopeCondition(scope, employees.countryCode);
  if (!inScope) return [];
  const rows = await db
    .select({ code: employees.employeeCode })
    .from(employees)
    .where(and(not(inScope), withCode(codes)));
  return rows.map((row) => row.code);
}

/** Components the caller's scope can use: its countries' own and the all-country ones. */
export function componentsInScope(db: Database, scope: Scope) {
  return db
    .select({
      id: payComponents.id,
      code: payComponents.code,
      name: payComponents.name,
      countryCode: payComponents.countryCode,
      isActive: payComponents.isActive,
    })
    .from(payComponents)
    .where(
      scope.kind === 'all'
        ? undefined
        : or(eq(payComponents.countryCode, scope.countryCode), isNull(payComponents.countryCode)),
    );
}

/** Pay items of the employees that are in force on a date, or have no end date yet. */
export function payItemsInScope(
  db: Database,
  scope: Scope,
  date: string,
  codes: readonly string[],
) {
  return db
    .select({
      id: payItems.id,
      employeeId: payItems.employeeId,
      componentId: payItems.componentId,
      amountMinor: payItems.amountMinor,
      currency: payItems.currencyCode,
      frequency: payItems.frequencyCode,
      effectiveFrom: payItems.effectiveFrom,
      effectiveTo: payItems.effectiveTo,
    })
    .from(payItems)
    .innerJoin(employees, eq(employees.id, payItems.employeeId))
    .where(
      and(
        scopeCondition(scope, employees.countryCode),
        withCode(codes),
        or(
          isNull(payItems.effectiveTo),
          and(lte(payItems.effectiveFrom, date), gt(payItems.effectiveTo, date)),
        ),
      ),
    );
}

/** The date of each employee's latest pay change, scheduled ones included. */
export function latestChangeDates(db: Database, scope: Scope, codes: readonly string[]) {
  return db
    .select({ employeeId: payChanges.employeeId, date: max(payChanges.effectiveFrom) })
    .from(payChanges)
    .innerJoin(employees, eq(employees.id, payChanges.employeeId))
    .where(and(scopeCondition(scope, employees.countryCode), withCode(codes)))
    .groupBy(payChanges.employeeId);
}
