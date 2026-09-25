import { describe, expect, it } from 'vitest';
import { IMPORT_LIMITS, importSummarySchema, templateQuerySchema } from './imports.ts';

describe('import schemas', () => {
  it('limit files to 10 MB and 100,000 rows, and Excel files to 1 MB and 20,000 rows', () => {
    expect(IMPORT_LIMITS).toMatchObject({
      maxBytes: 10_485_760,
      maxRows: 100_000,
      maxExcelBytes: 1_048_576,
      maxExcelRows: 20_000,
    });
  });

  it('read a template request, employees by default', () => {
    expect(templateQuerySchema.parse({ format: 'csv' })).toEqual({
      format: 'csv',
      dataset: 'employees',
    });
    expect(templateQuerySchema.safeParse({ format: 'xls' }).success).toBe(false);
  });

  it('describe problems by sheet, row and column', () => {
    const summary = {
      valid: false,
      employees: { added: 0, updated: 0, unchanged: 1 },
      pay: { changed: 0, unchanged: 0 },
      changes: [],
      errors: [
        { sheet: 'Employees', row: 3, column: 'Hire date', message: 'Enter a valid date' },
        { sheet: 'Pay components', row: null, column: null, message: 'Add the Amount column' },
      ],
      errorCount: 2,
    };
    expect(importSummarySchema.parse(summary)).toEqual(summary);
  });
});
