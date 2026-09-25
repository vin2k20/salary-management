import { z } from 'zod';
import { EXPORT_FORMATS, SPREADSHEET_DATASETS } from './spreadsheets.ts';

/**
 * Upload limits. A CSV file can hold a full export (about 3 MB for 60,000 pay rows). Excel files
 * are read whole into memory, several times their size, so they are kept small enough for the
 * free API plan (512 MB); larger data goes in CSV files.
 */
export const IMPORT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxRows: 100_000,
  maxExcelBytes: 1024 * 1024,
  maxExcelRows: 20_000,
  /** Problems and changes listed in a response; the counts always cover the whole file. */
  maxListed: 500,
} as const;

/** The empty file to fill in: Excel with both sheets, or CSV for one dataset. */
export const templateQuerySchema = z.object({
  format: z.enum(EXPORT_FORMATS, 'Choose xlsx or csv'),
  dataset: z.enum(SPREADSHEET_DATASETS).default('employees'),
});

export type TemplateQuery = z.infer<typeof templateQuerySchema>;

/** One problem with the file: a whole-file problem has no row, a row problem may name a column. */
export const importErrorSchema = z.object({
  sheet: z.string(),
  /** The row as numbered in the spreadsheet (the header is row 1), or null for the whole file. */
  row: z.number().int().positive().nullable(),
  column: z.string().nullable(),
  message: z.string(),
});

export type ImportError = z.infer<typeof importErrorSchema>;

export const IMPORT_ACTIONS = ['add', 'update', 'pay'] as const;

export type ImportAction = (typeof IMPORT_ACTIONS)[number];

/** A change the import makes: a new or changed employee, or a pay change for one employee. */
export const importChangeSchema = z.object({
  sheet: z.string(),
  row: z.number().int().positive(),
  employeeCode: z.string(),
  action: z.enum(IMPORT_ACTIONS),
  /** What changes, in words, such as "Job title, Department" or "Basic, HRA from 2026-10-01". */
  details: z.string(),
});

export type ImportChange = z.infer<typeof importChangeSchema>;

/** What a file does, or did: counts for the whole file, and the first problems and changes. */
export const importSummarySchema = z.object({
  valid: z.boolean(),
  employees: z.object({
    added: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
  }),
  pay: z.object({
    /** Employees whose pay changes, one pay change each. */
    changed: z.number().int().nonnegative(),
    /** Pay rows that match current pay. */
    unchanged: z.number().int().nonnegative(),
  }),
  changes: z.array(importChangeSchema),
  errors: z.array(importErrorSchema),
  /** Every problem in the file, even when only the first ones are listed. */
  errorCount: z.number().int().nonnegative(),
});

export type ImportSummary = z.infer<typeof importSummarySchema>;
