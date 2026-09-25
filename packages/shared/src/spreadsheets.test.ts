import { describe, expect, it } from 'vitest';
import { COUNTRY_FIELD_KEYS } from './employee-record.ts';
import { EMPLOYEE_COLUMNS, PAY_COLUMNS, exportQuerySchema } from './spreadsheets.ts';

describe('spreadsheet columns', () => {
  it('have a unique header and key in each dataset', () => {
    for (const columns of [EMPLOYEE_COLUMNS, PAY_COLUMNS]) {
      expect(new Set(columns.map((column) => column.header)).size).toBe(columns.length);
      expect(new Set(columns.map((column) => column.key)).size).toBe(columns.length);
    }
  });

  it('include every country-specific employee field', () => {
    const keys: string[] = EMPLOYEE_COLUMNS.map((column) => column.key);
    for (const field of Object.values(COUNTRY_FIELD_KEYS).flat()) {
      expect(keys).toContain(field);
    }
  });

  it('start both datasets with the employee code, which import matches on', () => {
    expect(EMPLOYEE_COLUMNS[0].key).toBe('employeeCode');
    expect(PAY_COLUMNS[0].key).toBe('employeeCode');
  });
});

describe('exportQuerySchema', () => {
  it('needs a format and exports employees by default', () => {
    expect(exportQuerySchema.safeParse({}).success).toBe(false);
    expect(exportQuerySchema.parse({ format: 'csv' })).toEqual({
      format: 'csv',
      dataset: 'employees',
      includeInactive: false,
    });
  });

  it('reads the directory filters', () => {
    expect(
      exportQuerySchema.parse({
        format: 'xlsx',
        dataset: 'pay',
        country: 'IN',
        department: ' Engineering ',
        includeInactive: 'true',
        search: '',
      }),
    ).toEqual({
      format: 'xlsx',
      dataset: 'pay',
      country: 'IN',
      department: 'Engineering',
      includeInactive: true,
    });
  });

  it('rejects unknown formats and datasets', () => {
    expect(exportQuerySchema.safeParse({ format: 'pdf' }).success).toBe(false);
    expect(exportQuerySchema.safeParse({ format: 'csv', dataset: 'users' }).success).toBe(false);
  });
});
