import { once } from 'node:events';
import type { Writable } from 'node:stream';
import {
  SPREADSHEETS,
  fromMinorUnits,
  type CurrencyCode,
  type EmployeeColumnKey,
  type PayColumnKey,
  type SpreadsheetColumn,
  type SpreadsheetDataset,
  type SpreadsheetRow,
} from '@salary/shared';
import ExcelJS from 'exceljs';
import type { Database } from '../../db/client.ts';
import type { Scope } from '../auth/scope.ts';
import type { EmployeeFilters } from '../employees/employees.repository.ts';
import { CSV_BOM, csvLine } from './csv.ts';
import { currentItemsFor, employeesAfter, type ExportEmployee } from './exports.repository.ts';

/** Rows read from the database at a time; enough to be quick, small enough to keep memory flat. */
export const EXPORT_BATCH_SIZE = 500;

type EmployeeRow = SpreadsheetRow<EmployeeColumnKey>;
type PayRow = SpreadsheetRow<PayColumnKey>;

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function yesNo(value: unknown): string | null {
  if (typeof value !== 'boolean') return null;
  return value ? 'yes' : 'no';
}

/** An employee as spreadsheet cells, in the form import reads back. */
export function toEmployeeRow(employee: ExportEmployee): EmployeeRow {
  const fields = employee.countryFields;
  return {
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    jobTitle: employee.jobTitle,
    jobLevel: employee.jobLevel,
    department: employee.department,
    countryCode: employee.countryCode,
    region: employee.region,
    employmentType: employee.employmentType,
    fte: String(employee.fte),
    hireDate: employee.hireDate,
    status: employee.status,
    inactiveOn: employee.inactiveOn,
    flsaStatus: text(fields.flsaStatus),
    award: text(fields.award),
    pfApplicable: yesNo(fields.pfApplicable),
    esiApplicable: yesNo(fields.esiApplicable),
  };
}

async function* employeeBatches(
  db: Database,
  scope: Scope,
  filters: EmployeeFilters,
  batchSize: number,
): AsyncGenerator<ExportEmployee[]> {
  let afterCode: string | null = null;
  for (;;) {
    const batch = await employeesAfter(db, scope, filters, afterCode, batchSize);
    if (batch.length > 0) yield batch;
    const last = batch.at(-1);
    if (!last || batch.length < batchSize) return;
    afterCode = last.employeeCode;
  }
}

/** Employees matching the filters, as rows, a batch at a time. */
export async function* employeeRowBatches(
  db: Database,
  scope: Scope,
  filters: EmployeeFilters,
  batchSize = EXPORT_BATCH_SIZE,
): AsyncGenerator<EmployeeRow[]> {
  for await (const batch of employeeBatches(db, scope, filters, batchSize)) {
    yield batch.map(toEmployeeRow);
  }
}

/**
 * Current pay of the employees matching the filters: one row per component in force today, with
 * the amount per period in major units ("50000.00"), a batch of employees at a time.
 */
export async function* payRowBatches(
  db: Database,
  scope: Scope,
  filters: EmployeeFilters,
  today: string,
  batchSize = EXPORT_BATCH_SIZE,
): AsyncGenerator<PayRow[]> {
  for await (const batch of employeeBatches(db, scope, filters, batchSize)) {
    const items = await currentItemsFor(
      db,
      scope,
      batch.map((employee) => employee.id),
      today,
    );
    if (items.length === 0) continue;
    yield items.map((item) => ({
      employeeCode: item.employeeCode,
      componentCode: item.componentCode,
      amount: fromMinorUnits(item.amountMinor, item.currency as CurrencyCode),
      currency: item.currency,
      frequency: item.frequency,
      effectiveFrom: item.effectiveFrom,
    }));
  }
}

/** Where a file's rows come from: batches of rows for each dataset. */
export type RowSource = (
  dataset: SpreadsheetDataset,
) => AsyncIterable<Record<string, string | null>[]> | Iterable<Record<string, string | null>[]>;

/** Rows of the employees matching the filters, and their current pay. */
function exportSource(
  db: Database,
  scope: Scope,
  filters: EmployeeFilters,
  today: string,
): RowSource {
  return (dataset) =>
    dataset === 'employees'
      ? employeeRowBatches(db, scope, filters)
      : payRowBatches(db, scope, filters, today);
}

function headerRow(columns: readonly SpreadsheetColumn[]): Record<string, string> {
  return Object.fromEntries(columns.map((column) => [column.key, column.header]));
}

/** Writes text to the response, waiting whenever the client is slower than the database. */
async function write(stream: Writable, chunk: string) {
  if (!stream.write(chunk)) await once(stream, 'drain');
}

/** One dataset as a CSV file, with formulas escaped (HLD 7). */
export async function writeCsvRows(
  stream: Writable,
  dataset: SpreadsheetDataset,
  source: RowSource,
) {
  const { columns } = SPREADSHEETS[dataset];
  const textColumns = columns.map((column) => ({ ...column, kind: 'text' as const }));
  // Headers are plain words, written like text cells.
  await write(stream, CSV_BOM + csvLine(textColumns, headerRow(columns)));
  for await (const batch of source(dataset)) {
    await write(stream, batch.map((row) => csvLine(columns, row)).join(''));
  }
  stream.end();
}

/** The employees matching the filters, or their current pay, as a CSV file. */
export async function writeCsv(
  stream: Writable,
  dataset: SpreadsheetDataset,
  db: Database,
  scope: Scope,
  filters: EmployeeFilters,
  today: string,
) {
  await writeCsvRows(stream, dataset, exportSource(db, scope, filters, today));
}

/**
 * A cell value for Excel. Text and dates stay typed text, which Excel never runs as a formula;
 * amounts and decimals become numbers so HR can sort and add them up. This is the only place
 * money becomes a floating point number, at the file boundary, from its exact decimal text.
 */
function cellValue(value: string | null, column: SpreadsheetColumn): string | number | null {
  if (value === null) return null;
  return column.kind === 'amount' || column.kind === 'decimal' ? Number(value) : value;
}

/** Both datasets as one Excel file with two sheets, streamed as it is written. */
export async function writeXlsxRows(stream: Writable, source: RowSource) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream,
    useStyles: true,
    useSharedStrings: false,
  });
  for (const dataset of ['employees', 'pay'] as const) {
    const { sheetName, columns } = SPREADSHEETS[dataset];
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = columns.map((column) => ({ width: Math.max(12, column.header.length + 2) }));
    const header = sheet.addRow(columns.map((column) => column.header));
    header.font = { bold: true };
    header.commit();
    for await (const batch of source(dataset)) {
      for (const values of batch) {
        const row = sheet.addRow(
          columns.map((column) => cellValue(values[column.key] ?? null, column)),
        );
        columns.forEach((column, index) => {
          if (column.kind === 'amount') row.getCell(index + 1).numFmt = '0.00';
        });
        row.commit();
      }
    }
    sheet.commit();
  }
  await workbook.commit();
}

/** The employees matching the filters and their current pay, as one Excel file. */
export async function writeXlsx(
  stream: Writable,
  db: Database,
  scope: Scope,
  filters: EmployeeFilters,
  today: string,
) {
  await writeXlsxRows(stream, exportSource(db, scope, filters, today));
}
