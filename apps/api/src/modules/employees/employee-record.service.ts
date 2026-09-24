import {
  COUNTRY_FIELD_KEYS,
  countryFieldsSchema,
  countryName,
  type CountryCode,
  type CreateEmployeeRequest,
  type CurrentUser,
  type Employee,
} from '@salary/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { isUniqueViolation } from '../../db/errors.ts';
import { employees } from '../../db/schema.ts';
import { HttpError } from '../../http/errors.ts';
import { scopeCondition, type Scope } from '../auth/scope.ts';
import { diffFields, recordChange } from '../change-log/change-log.ts';

export type EmployeeRecord = typeof employees.$inferSelect;

export function toEmployee(row: EmployeeRecord): Employee {
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    jobTitle: row.jobTitle,
    jobLevel: row.jobLevel,
    department: row.department,
    countryCode: row.countryCode as CountryCode,
    region: row.region,
    employmentType: row.employmentType,
    fte: row.fte,
    hireDate: row.hireDate,
    status: row.status,
    inactiveOn: row.inactiveOn,
    countryFields: countryFieldsSchema.parse(row.countryFields),
  };
}

/**
 * Fields written to the change log. Country-specific fields are listed one by one, so the log
 * shows "FLSA status: exempt to non-exempt" rather than two whole objects.
 */
export function loggedFields(employee: Employee): Record<string, unknown> {
  const { id: _id, countryFields, ...details } = employee;
  const fields: Record<string, unknown> = { ...details };
  for (const key of COUNTRY_FIELD_KEYS[employee.countryCode]) {
    fields[key] = countryFields[key] ?? null;
  }
  return fields;
}

/** An employee in the caller's scope; records outside it are treated as missing (404). */
export async function findEmployee(
  db: Database,
  scope: Scope,
  id: string,
): Promise<EmployeeRecord | undefined> {
  const [row] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), scopeCondition(scope, employees.countryCode)));
  return row;
}

export async function findEmployeeOrThrow(db: Database, scope: Scope, id: string) {
  const row = await findEmployee(db, scope, id);
  if (!row) throw new HttpError(404, 'Employee not found');
  return row;
}

/**
 * The spelling already stored in the caller's scope for a job title or department, ignoring
 * case, so "software engineer" joins "Software Engineer" in filters and statistics. New values
 * are kept as typed.
 */
export async function storedSpelling(db: Database, scope: Scope, column: PgColumn, value: string) {
  const [row] = await db
    .select({ value: column })
    .from(employees)
    .where(
      and(sql`lower(${column}) = lower(${value})`, scopeCondition(scope, employees.countryCode)),
    )
    .orderBy(asc(column))
    .limit(1);
  return typeof row?.value === 'string' ? row.value : value;
}

/** Adds an active employee in the caller's scope, in one transaction with the change log. */
export async function createEmployee(
  db: Database,
  scope: Scope,
  input: CreateEmployeeRequest,
  actor: CurrentUser,
  clock: Clock,
): Promise<Employee> {
  if (scope.kind === 'country' && scope.countryCode !== input.countryCode) {
    throw new HttpError(403, `You can only add employees in ${countryName(scope.countryCode)}`);
  }
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(employees)
        .values({
          ...input,
          jobTitle: await storedSpelling(tx, scope, employees.jobTitle, input.jobTitle),
          department: await storedSpelling(tx, scope, employees.department, input.department),
        })
        .returning();
      if (!row) throw new Error('Employee was not inserted');
      const employee = toEmployee(row);
      await recordChange(
        tx,
        {
          entityType: 'employee',
          entityId: employee.id,
          action: 'created',
          changes: diffFields(null, loggedFields(employee)),
          countryCode: employee.countryCode,
          changedBy: actor.id,
        },
        clock,
      );
      return employee;
    });
  } catch (error) {
    // The unique constraint also covers two requests adding the same code at once.
    if (isUniqueViolation(error, 'employees_employee_code_unique')) {
      throw new HttpError(409, `An employee with the code ${input.employeeCode} already exists`);
    }
    throw error;
  }
}
