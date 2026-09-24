import type { employees } from '../db/schema.ts';

type NewEmployee = typeof employees.$inferInsert;

let sequence = 0;

/** Values for a valid employee; tests override only the fields they care about. */
export function employeeValues(overrides: Partial<NewEmployee> = {}): NewEmployee {
  sequence += 1;
  return {
    employeeCode: `E${String(sequence).padStart(5, '0')}`,
    firstName: 'Test',
    lastName: `Employee ${String(sequence)}`,
    email: `employee${String(sequence)}@example.com`,
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    countryCode: 'IN',
    region: 'Karnataka',
    employmentType: 'full_time',
    hireDate: '2024-04-01',
    ...overrides,
  };
}
