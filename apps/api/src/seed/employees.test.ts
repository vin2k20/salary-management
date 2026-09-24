import { createEmployeeRequestSchema } from '@salary/shared';
import { describe, expect, it } from 'vitest';
import { generateEmployees } from './employees.ts';

const options = { count: 500, seed: 20_260_924, referenceDate: '2026-09-01' };

describe('generateEmployees', () => {
  it('returns the same employees for the same seed', () => {
    expect(generateEmployees(options)).toEqual(generateEmployees(options));
  });

  it('returns different employees for a different seed', () => {
    const first = generateEmployees(options);
    const second = generateEmployees({ ...options, seed: 1 });

    expect(second.map((employee) => employee.lastName)).not.toEqual(
      first.map((employee) => employee.lastName),
    );
  });

  it('gives every employee a unique ID, code and email', () => {
    const employees = generateEmployees(options);

    for (const field of ['id', 'employeeCode', 'email'] as const) {
      expect(new Set(employees.map((employee) => employee[field])).size).toBe(employees.length);
    }
  });

  it('passes the same checks as an employee added through the API', () => {
    for (const employee of generateEmployees(options)) {
      const result = createEmployeeRequestSchema.safeParse(employee);

      expect(result.error?.issues ?? [], employee.employeeCode).toEqual([]);
    }
  });
});
