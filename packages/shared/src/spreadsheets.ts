import { z } from 'zod';
import { countryCodeSchema } from './countries.ts';
import { EMPLOYMENT_TYPES } from './employees.ts';
import { booleanParam, optionalParam, optionalTextParam } from './query-params.ts';

/**
 * How a cell is written. Text and dates are text in both formats (dates as YYYY-MM-DD, so no
 * time zone can shift them); amounts and decimals are numbers in Excel and plain text in CSV.
 */
export type CellKind = 'text' | 'date' | 'decimal' | 'amount';

export interface SpreadsheetColumn<Key extends string = string> {
  key: Key;
  header: string;
  kind: CellKind;
}

/**
 * Employees, one row each. Choices are written as the codes the API uses (full_time, exempt),
 * and yes or no fields as "yes" or "no". Country fields are empty for other countries.
 */
export const EMPLOYEE_COLUMNS = [
  { key: 'employeeCode', header: 'Employee code', kind: 'text' },
  { key: 'firstName', header: 'First name', kind: 'text' },
  { key: 'lastName', header: 'Last name', kind: 'text' },
  { key: 'email', header: 'Email', kind: 'text' },
  { key: 'jobTitle', header: 'Job title', kind: 'text' },
  { key: 'jobLevel', header: 'Job level', kind: 'text' },
  { key: 'department', header: 'Department', kind: 'text' },
  { key: 'countryCode', header: 'Country', kind: 'text' },
  { key: 'region', header: 'Region', kind: 'text' },
  { key: 'employmentType', header: 'Employment type', kind: 'text' },
  { key: 'fte', header: 'FTE', kind: 'decimal' },
  { key: 'hireDate', header: 'Hire date', kind: 'date' },
  { key: 'status', header: 'Status', kind: 'text' },
  { key: 'inactiveOn', header: 'Inactive date', kind: 'date' },
  { key: 'flsaStatus', header: 'FLSA status (US)', kind: 'text' },
  { key: 'award', header: 'Award (AU)', kind: 'text' },
  { key: 'pfApplicable', header: 'PF applicable (IN)', kind: 'text' },
  { key: 'esiApplicable', header: 'ESI applicable (IN)', kind: 'text' },
] as const satisfies readonly SpreadsheetColumn[];

/**
 * Current pay, one row per employee and component in force today. The amount is per period of
 * the frequency, in major units of the currency (50000.00).
 */
export const PAY_COLUMNS = [
  { key: 'employeeCode', header: 'Employee code', kind: 'text' },
  { key: 'componentCode', header: 'Component code', kind: 'text' },
  { key: 'amount', header: 'Amount', kind: 'amount' },
  { key: 'currency', header: 'Currency', kind: 'text' },
  { key: 'frequency', header: 'Frequency', kind: 'text' },
  { key: 'effectiveFrom', header: 'Effective from', kind: 'date' },
] as const satisfies readonly SpreadsheetColumn[];

export type EmployeeColumnKey = (typeof EMPLOYEE_COLUMNS)[number]['key'];
export type PayColumnKey = (typeof PAY_COLUMNS)[number]['key'];

/** A row of cell values by column key; null is an empty cell. */
export type SpreadsheetRow<Key extends string> = Record<Key, string | null>;

export const SPREADSHEET_DATASETS = ['employees', 'pay'] as const;

export type SpreadsheetDataset = (typeof SPREADSHEET_DATASETS)[number];

/** Each dataset's sheet name, file name and columns; an Excel file holds both sheets. */
export const SPREADSHEETS = {
  employees: { sheetName: 'Employees', fileName: 'employees', columns: EMPLOYEE_COLUMNS },
  pay: { sheetName: 'Pay components', fileName: 'pay-components', columns: PAY_COLUMNS },
} as const satisfies Record<
  SpreadsheetDataset,
  { sheetName: string; fileName: string; columns: readonly SpreadsheetColumn[] }
>;

export const EXPORT_FORMATS = ['xlsx', 'csv'] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * An export: the directory's filters, the format and, for CSV, which dataset. An Excel file
 * always holds both datasets, so `dataset` only matters for CSV.
 */
export const exportQuerySchema = z.object({
  format: z.enum(EXPORT_FORMATS, 'Choose xlsx or csv'),
  dataset: optionalParam(z.enum(SPREADSHEET_DATASETS)).default('employees'),
  search: optionalTextParam,
  country: optionalParam(countryCodeSchema),
  region: optionalTextParam,
  department: optionalTextParam,
  jobTitle: optionalTextParam,
  employmentType: optionalParam(z.enum(EMPLOYMENT_TYPES)),
  includeInactive: booleanParam,
});

export type ExportQuery = z.infer<typeof exportQuerySchema>;
