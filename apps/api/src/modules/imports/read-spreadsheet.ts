import {
  IMPORT_LIMITS,
  SPREADSHEETS,
  type ImportError,
  type SpreadsheetColumn,
  type SpreadsheetDataset,
} from '@salary/shared';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

/** A cell as read: CSV cells are always text; Excel cells keep their type. */
export type RawCell = string | number | boolean | Date | null;

export interface SheetRow {
  /** The row as numbered in the spreadsheet; the header is row 1. */
  row: number;
  /** Cells by column key; empty cells are left out. */
  cells: Partial<Record<string, RawCell>>;
}

export interface SheetRows {
  dataset: SpreadsheetDataset;
  sheet: string;
  rows: SheetRow[];
}

export interface ReadResult {
  sheets: SheetRows[];
  errors: ImportError[];
}

const FILE = 'File';
const countFormat = new Intl.NumberFormat('en-US');

function fileError(message: string): ReadResult {
  return { sheets: [], errors: [{ sheet: FILE, row: null, column: null, message }] };
}

/** Column index by key from a header row matched by name, ignoring case; or the missing ones. */
function mapHeaders(
  dataset: SpreadsheetDataset,
  headers: string[],
): { indexes: Map<string, number>; errors: ImportError[] } {
  const { sheetName, columns } = SPREADSHEETS[dataset];
  const byName = new Map(headers.map((header, index) => [header.trim().toLowerCase(), index]));
  const indexes = new Map<string, number>();
  const errors: ImportError[] = [];
  for (const column of columns as readonly SpreadsheetColumn[]) {
    const index = byName.get(column.header.toLowerCase());
    if (index === undefined) {
      errors.push({
        sheet: sheetName,
        row: null,
        column: column.header,
        message: `Add the ${column.header} column`,
      });
    } else {
      indexes.set(column.key, index);
    }
  }
  return { indexes, errors };
}

function isEmpty(cell: RawCell | undefined): boolean {
  return cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '');
}

/** Keeps the cells of known columns and drops empty rows. */
function toRows(
  records: { row: number; values: RawCell[] }[],
  indexes: Map<string, number>,
): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const record of records) {
    const cells: Partial<Record<string, RawCell>> = {};
    for (const [key, index] of indexes) {
      const cell = record.values[index] ?? null;
      if (!isEmpty(cell)) cells[key] = cell;
    }
    if (Object.keys(cells).length > 0) rows.push({ row: record.row, cells });
  }
  return rows;
}

function tooManyRows(count: number, maxRows: number): ReadResult | null {
  return count > maxRows
    ? fileError(`Use at most ${countFormat.format(maxRows)} rows in one file`)
    : null;
}

/** Export puts an apostrophe before text that starts like a formula (HLD 7); take it off. */
function unescapeFormula(text: string): string {
  return /^'[=+\-@\t\r]/.test(text) ? text.slice(1) : text;
}

function readCsv(buffer: Buffer, maxRows: number): ReadResult {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return fileError('Save the CSV file with UTF-8 encoding');
  }
  let records: string[][];
  try {
    records = parse(text, { bom: true, relax_column_count: true, skip_empty_lines: false });
  } catch {
    return fileError('The CSV file could not be read');
  }
  const [headers = [], ...data] = records;
  const names = headers.map((header) => header.trim().toLowerCase());
  let dataset: SpreadsheetDataset | null = null;
  if (names.includes('component code')) dataset = 'pay';
  else if (names.includes('first name')) dataset = 'employees';
  if (dataset === null) {
    return fileError('The columns do not match the employee or pay component template');
  }
  const { indexes, errors } = mapHeaders(dataset, headers);
  if (errors.length > 0) return { sheets: [], errors };
  const rows = toRows(
    data.map((values, index) => ({ row: index + 2, values: values.map(unescapeFormula) })),
    indexes,
  );
  return (
    tooManyRows(rows.length, maxRows) ?? {
      sheets: [{ dataset, sheet: SPREADSHEETS[dataset].sheetName, rows }],
      errors: [],
    }
  );
}

/**
 * An Excel cell as a plain value. Links (Excel turns emails into links) and rich text become
 * their text; formulas and error values are problems, since their shown value is not stored
 * reliably.
 */
function excelCell(value: ExcelJS.CellValue): RawCell | { problem: string } {
  if (value === null || value === undefined) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  ) {
    return value;
  }
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('hyperlink' in value) return typeof value.text === 'string' ? value.text : null;
  if ('error' in value) return { problem: `Replace the error value ${value.error}` };
  if ('formula' in value || 'sharedFormula' in value) {
    return { problem: 'Replace the formula with its value' };
  }
  return { problem: 'This cell could not be read' };
}

async function readXlsx(buffer: Buffer, maxRows: number): Promise<ReadResult> {
  const book = new ExcelJS.Workbook();
  try {
    // ExcelJS takes the bytes as an ArrayBuffer.
    await book.xlsx.load(Uint8Array.from(buffer).buffer);
  } catch {
    return fileError('The Excel file could not be read');
  }
  const sheets: SheetRows[] = [];
  const errors: ImportError[] = [];
  let total = 0;
  for (const dataset of ['employees', 'pay'] as const) {
    const { sheetName, columns } = SPREADSHEETS[dataset];
    const worksheet = book.worksheets.find(
      (sheet) => sheet.name.trim().toLowerCase() === sheetName.toLowerCase(),
    );
    if (!worksheet) continue;
    const header = worksheet.getRow(1);
    const headers = Array.from(
      { length: header.cellCount },
      (_, index) => header.getCell(index + 1).text,
    );
    const mapped = mapHeaders(dataset, headers);
    if (mapped.errors.length > 0) {
      errors.push(...mapped.errors);
      continue;
    }
    const headerOf = new Map(
      (columns as readonly SpreadsheetColumn[]).map((column) => [column.key, column.header]),
    );
    const records: { row: number; values: RawCell[] }[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const values: RawCell[] = [];
      for (const [key, index] of mapped.indexes) {
        const cell = excelCell(row.getCell(index + 1).value);
        if (cell !== null && typeof cell === 'object' && 'problem' in cell) {
          errors.push({
            sheet: sheetName,
            row: rowNumber,
            column: headerOf.get(key) ?? null,
            message: cell.problem,
          });
          values[index] = null;
        } else {
          values[index] = cell;
        }
      }
      records.push({ row: rowNumber, values });
    });
    const rows = toRows(records, mapped.indexes);
    total += rows.length;
    sheets.push({ dataset, sheet: sheetName, rows });
  }
  if (sheets.length === 0 && errors.length === 0) {
    return fileError('Add an Employees or Pay components sheet');
  }
  return tooManyRows(total, maxRows) ?? { sheets: errors.length > 0 ? [] : sheets, errors };
}

const ZIP_START = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Reads an uploaded file into rows by column key. The type comes from the file name and is
 * checked against the content: an .xlsx file is a zip archive, a .csv file is UTF-8 text.
 */
export async function readSpreadsheet(
  file: { name: string; buffer: Buffer },
  {
    maxRows = IMPORT_LIMITS.maxRows,
    maxExcelBytes = IMPORT_LIMITS.maxExcelBytes,
    maxExcelRows = IMPORT_LIMITS.maxExcelRows,
  }: { maxRows?: number; maxExcelBytes?: number; maxExcelRows?: number } = {},
): Promise<ReadResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    if (!file.buffer.subarray(0, 4).equals(ZIP_START)) {
      return fileError('This is not an Excel (.xlsx) file');
    }
    // Checked before reading, since reading the whole workbook is what takes the memory.
    if (file.buffer.length > maxExcelBytes) {
      return fileError(
        `Excel files can be up to ${String(maxExcelBytes / (1024 * 1024))} MB (about ${countFormat.format(maxExcelRows)} rows). Split the file, or save each sheet as a CSV file.`,
      );
    }
    return readXlsx(file.buffer, Math.min(maxRows, maxExcelRows));
  }
  if (name.endsWith('.csv')) {
    if (file.buffer.includes(0)) return fileError('This is not a CSV file');
    return readCsv(file.buffer, maxRows);
  }
  return fileError('Choose an Excel (.xlsx) or CSV (.csv) file');
}
