import {
  COUNTRY_FIELD_KEYS,
  countryFieldsSchema,
  countryName,
  type CountryCode,
  countryDetailIssues,
  inactiveDateIssue,
  type CreateEmployeeRequest,
  type CurrentUser,
  type DetailIssue,
  type Employee,
  type UpdateEmployeeRequest,
} from '@salary/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { isUniqueViolation } from '../../db/errors.ts';
import { employees } from '../../db/schema.ts';
import { HttpError, RequestValidationError } from '../../http/errors.ts';
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

/** The employee after an update, with the status rules applied, and any problems with it. */
export function applyUpdate(
  current: Employee,
  update: UpdateEmployeeRequest,
  today: string,
): { next: Employee; issues: DetailIssue[] } {
  const next: Employee = { ...current, ...update };
  if (update.status === 'active' && update.inactiveOn === undefined) next.inactiveOn = null;
  if (next.status === 'inactive' && next.inactiveOn === null) next.inactiveOn = today;

  const issues = countryDetailIssues(next);
  if (next.status === 'active' && next.inactiveOn !== null) {
    issues.push({ path: ['inactiveOn'], message: 'Only inactive employees have an inactive date' });
  }
  if (next.status === 'inactive' && next.inactiveOn !== null) {
    const message = inactiveDateIssue(next.hireDate, next.inactiveOn, today);
    if (message) issues.push({ path: ['inactiveOn'], message });
  }
  return { next, issues };
}

/**
 * Changes an employee's details, or marks them inactive or active again, in one transaction with
 * the change log. The employee keeps their pay and history when marked inactive.
 */
export async function updateEmployee(
  db: Database,
  scope: Scope,
  id: string,
  update: UpdateEmployeeRequest,
  actor: CurrentUser,
  clock: Clock,
): Promise<Employee> {
  return db.transaction(async (tx) => {
    const current = toEmployee(await findEmployeeOrThrow(tx, scope, id));
    const { next, issues } = applyUpdate(current, update, clock.now().toISOString().slice(0, 10));
    if (issues.length > 0) {
      throw new RequestValidationError(
        issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      );
    }
    if (update.jobTitle !== undefined) {
      next.jobTitle = await storedSpelling(tx, scope, employees.jobTitle, update.jobTitle);
    }
    if (update.department !== undefined) {
      next.department = await storedSpelling(tx, scope, employees.department, update.department);
    }

    const { id: _id, employeeCode: _code, countryCode: _country, ...details } = next;
    const [row] = await tx
      .update(employees)
      .set({ ...details, updatedAt: clock.now() })
      .where(eq(employees.id, id))
      .returning();
    if (!row) throw new HttpError(404, 'Employee not found');
    const updated = toEmployee(row);

    await recordChange(
      tx,
      {
        entityType: 'employee',
        entityId: id,
        action:
          current.status === 'active' && updated.status === 'inactive' ? 'inactivated' : 'updated',
        changes: diffFields(loggedFields(current), loggedFields(updated)),
        countryCode: updated.countryCode,
        changedBy: actor.id,
      },
      clock,
    );
    return updated;
  });
}
