import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { employeeValues } from '../test/fixtures.ts';
import { createTestDatabase, type TestDatabase } from '../test/test-database.ts';
import { employees } from './schema.ts';

describe('employees table', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  function insert(overrides: Parameters<typeof employeeValues>[0]) {
    return database.db.insert(employees).values(employeeValues(overrides)).returning();
  }

  it('stores an employee with defaults for FTE, status and country fields', async () => {
    const [employee] = await insert({ countryFields: { pfApplicable: true } });

    expect(employee).toMatchObject({
      fte: 1,
      status: 'active',
      inactiveOn: null,
      countryFields: { pfApplicable: true },
    });
  });

  it('rejects a duplicate employee code', async () => {
    await insert({ employeeCode: 'DUP-1' });
    await expect(insert({ employeeCode: 'DUP-1' })).rejects.toThrow();
  });

  it('requires an inactive date exactly when the employee is inactive', async () => {
    await expect(insert({ status: 'inactive', inactiveOn: '2026-06-30' })).resolves.toHaveLength(1);
    await expect(insert({ status: 'inactive' })).rejects.toThrow();
    await expect(insert({ status: 'active', inactiveOn: '2026-06-30' })).rejects.toThrow();
  });

  it('keeps FTE above zero and at most one', async () => {
    await expect(insert({ fte: 0.5 })).resolves.toHaveLength(1);
    await expect(insert({ fte: 0 })).rejects.toThrow();
    await expect(insert({ fte: 1.5 })).rejects.toThrow();
  });

  it('rejects an unknown country or employment type', async () => {
    await expect(insert({ countryCode: 'GB' })).rejects.toThrow();
    await expect(
      insert({ employmentType: 'freelancer' as unknown as 'contractor' }),
    ).rejects.toThrow();
  });
});
