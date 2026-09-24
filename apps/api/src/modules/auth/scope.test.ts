import type { CurrentUser } from '@salary/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { employees } from '../../db/schema.ts';
import { insertEmployee } from '../../test/fixtures.ts';
import { createTestDatabase, type TestDatabase } from '../../test/test-database.ts';
import { isInScope, scopeCondition, scopeFor } from './scope.ts';

const base = { id: '6f1c2a4e-8b4d-4c5e-9f3a-2b7d1e0c9a11', email: 'x@acme.example.com', name: 'X' };
const globalHr: CurrentUser = { ...base, role: 'global_hr', countryCode: null };
const indiaHr: CurrentUser = { ...base, role: 'country_hr', countryCode: 'IN' };

describe('scope', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
    await insertEmployee(database.db, { countryCode: 'IN', department: 'Scope test' });
    await insertEmployee(database.db, {
      countryCode: 'US',
      region: 'Texas',
      department: 'Scope test',
    });
  });

  afterAll(async () => {
    await database.close();
  });

  async function visibleCountries(user: CurrentUser) {
    const rows = await database.db
      .select({ countryCode: employees.countryCode })
      .from(employees)
      .where(
        and(
          eq(employees.department, 'Scope test'),
          scopeCondition(scopeFor(user), employees.countryCode),
        ),
      );
    return rows.map((row) => row.countryCode).sort();
  }

  it('limits a country HR user to their own country', async () => {
    expect(scopeFor(indiaHr)).toEqual({ kind: 'country', countryCode: 'IN' });
    expect(await visibleCountries(indiaHr)).toEqual(['IN']);
  });

  it('does not limit a global HR user', async () => {
    expect(scopeFor(globalHr)).toEqual({ kind: 'all' });
    expect(await visibleCountries(globalHr)).toEqual(['IN', 'US']);
  });

  it('checks single records against the scope', () => {
    expect(isInScope(scopeFor(indiaHr), 'IN')).toBe(true);
    expect(isInScope(scopeFor(indiaHr), 'US')).toBe(false);
    expect(isInScope(scopeFor(indiaHr), null)).toBe(false);
    expect(isInScope(scopeFor(globalHr), 'US')).toBe(true);
    expect(isInScope(scopeFor(globalHr), null)).toBe(true);
  });

  it('refuses a country HR user without a country', () => {
    expect(() => scopeFor({ ...indiaHr, countryCode: null })).toThrow(/country/);
  });
});
