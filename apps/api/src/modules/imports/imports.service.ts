import type { Writable } from 'node:stream';
import type {
  CountryCode,
  CurrentUser,
  Employee,
  ImportSummary,
  PayFrequencyCode,
  SpreadsheetDataset,
} from '@salary/shared';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import type { Scope } from '../auth/scope.ts';
import { loadComponents, loadPayState, lockEmployee } from '../compensation/pay.repository.ts';
import { planPayChange, type PayState } from '../compensation/pay-rules.ts';
import { savePayPlan, throwIfInvalid } from '../compensation/pay.service.ts';
import {
  createEmployee,
  toEmployee,
  updateEmployee,
} from '../employees/employee-record.service.ts';
import { writeCsvRows, writeXlsxRows } from '../exports/exports.service.ts';
import { planImport, summarize, type ImportContext, type TodayItem } from './import-rules.ts';
import {
  codesOutsideScope,
  componentsInScope,
  employeesInScope,
  latestChangeDates,
  payItemsInScope,
} from './imports.repository.ts';
import { readSpreadsheet, type ReadResult } from './read-spreadsheet.ts';

export interface UploadedFile {
  name: string;
  buffer: Buffer;
}

export function todayFor(clock: Clock): string {
  return clock.now().toISOString().slice(0, 10);
}

/** Everything the import rules need about the caller's scope, read in a few bulk queries. */
export async function loadContext(
  db: Database,
  scope: Scope,
  today: string,
): Promise<ImportContext> {
  // One after another: inside the commit transaction they share a single connection.
  const rows = await employeesInScope(db, scope);
  const outside = await codesOutsideScope(db, scope);
  const components = await componentsInScope(db, scope);
  const items = await payItemsInScope(db, scope, today);
  const latest = await latestChangeDates(db, scope);
  const latestById = new Map(latest.map((row) => [row.employeeId, row.date]));
  const payToday = new Map<string, Map<string, TodayItem>>();
  const payStates = new Map<string, PayState>();
  const employees = rows.map(toEmployee);
  for (const employee of employees) {
    payToday.set(employee.id, new Map());
    payStates.set(employee.id, {
      countryCode: employee.countryCode,
      hireDate: employee.hireDate,
      latestChangeDate: latestById.get(employee.id) ?? null,
      openItems: [],
    });
  }
  for (const item of items) {
    if (item.effectiveFrom <= today && (item.effectiveTo === null || item.effectiveTo > today)) {
      payToday.get(item.employeeId)?.set(item.componentId, {
        amountMinor: item.amountMinor,
        currency: item.currency,
        frequency: item.frequency,
      });
    }
    if (item.effectiveTo === null) {
      payStates.get(item.employeeId)?.openItems.push({
        id: item.id,
        componentId: item.componentId,
        amountMinor: item.amountMinor,
        frequency: item.frequency as PayFrequencyCode,
      });
    }
  }
  return {
    scope,
    today,
    employees: new Map(employees.map((employee) => [employee.employeeCode, employee])),
    codesOutsideScope: new Set(outside),
    components: components.map((component) => ({
      ...component,
      countryCode: component.countryCode as CountryCode | null,
    })),
    payToday,
    payStates,
  };
}

/** A summary for a file that could not be read: only the problems. */
function unreadable(read: ReadResult): ImportSummary {
  return summarize({
    plan: { creates: [], updates: [], payChanges: [], unchangedEmployees: 0, unchangedPay: 0 },
    errors: read.errors,
  });
}

/** Checks a file and previews its changes; nothing is saved. */
export async function validateImport(
  db: Database,
  scope: Scope,
  file: UploadedFile,
  clock: Clock,
): Promise<ImportSummary> {
  const read = await readSpreadsheet(file);
  if (read.errors.length > 0) return unreadable(read);
  const context = await loadContext(db, scope, todayFor(clock));
  return summarize(planImport(read.sheets, context));
}

function problems(count: number): HttpError {
  const noun = count === 1 ? 'problem' : 'problems';
  return new HttpError(
    422,
    `The file has ${String(count)} ${noun}. Check it again to see the list.`,
  );
}

/**
 * Saves a file in one transaction (D20): it is checked again against the data as it is now, and
 * nothing is saved unless every row is valid. Employees are added and changed, and pay changes
 * recorded with the reason "import", through the same services as the forms, so the change log
 * is written the same way.
 */
export async function commitImport(
  db: Database,
  scope: Scope,
  file: UploadedFile,
  actor: CurrentUser,
  clock: Clock,
): Promise<ImportSummary> {
  const read = await readSpreadsheet(file);
  if (read.errors.length > 0) throw problems(read.errors.length);
  return db.transaction(async (tx) => {
    const result = planImport(read.sheets, await loadContext(tx, scope, todayFor(clock)));
    if (result.errors.length > 0) throw problems(result.errors.length);

    const created = new Map<string, Employee>();
    for (const { request } of result.plan.creates) {
      created.set(request.employeeCode, await createEmployee(tx, scope, request, actor, clock));
    }
    for (const { id, update } of result.plan.updates) {
      await updateEmployee(tx, scope, id, update, actor, clock);
    }
    for (const change of result.plan.payChanges) {
      const id = change.employeeId ?? created.get(change.employeeCode)?.id;
      const employee = id === undefined ? undefined : await lockEmployee(tx, scope, id);
      if (!employee) throw new Error(`Employee ${change.employeeCode} was not found`);
      const state = await loadPayState(tx, scope, employee);
      const components = await loadComponents(tx, scope, [
        ...change.set.map((line) => line.componentId),
        ...state.openItems.map((item) => item.componentId),
      ]);
      const plan = throwIfInvalid(
        planPayChange(
          state,
          { effectiveFrom: change.effectiveFrom, set: change.set, end: [] },
          components,
        ),
      );
      await savePayPlan(tx, {
        scope,
        employee,
        effectiveFrom: change.effectiveFrom,
        reason: 'import',
        note: null,
        plan,
        openItems: state.openItems,
        actor,
        clock,
      });
    }
    return summarize(result);
  });
}

/** An empty file to fill in: the same columns as export, with no rows. */
export async function writeTemplate(
  stream: Writable,
  format: 'xlsx' | 'csv',
  dataset: SpreadsheetDataset,
) {
  const noRows = () => [];
  if (format === 'csv') await writeCsvRows(stream, dataset, noRows);
  else await writeXlsxRows(stream, noRows);
}
