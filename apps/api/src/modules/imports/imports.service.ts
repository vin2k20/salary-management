import type { Writable } from 'node:stream';
import type {
  CountryCode,
  ImportSummary,
  PayFrequencyCode,
  SpreadsheetDataset,
} from '@salary/shared';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import type { Scope } from '../auth/scope.ts';
import type { PayState } from '../compensation/pay-rules.ts';
import { toEmployee } from '../employees/employee-record.service.ts';
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
