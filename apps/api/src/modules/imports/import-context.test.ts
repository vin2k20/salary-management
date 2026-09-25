import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertExportData } from '../../test/export-data.ts';
import { createTestDatabase, type TestDatabase } from '../../test/test-database.ts';
import { loadContext } from './imports.service.ts';

const TODAY = '2026-09-24';

describe('loadContext', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
    await insertExportData(database.db);
  });

  afterAll(async () => {
    await database.close();
  });

  it('loads only the employees the file names', async () => {
    const context = await loadContext(database.db, { kind: 'all' }, TODAY, [
      'IN-1',
      'US-1',
      'NEW-1',
    ]);

    expect([...context.employees.keys()].sort()).toEqual(['IN-1', 'US-1']);
    expect(context.payToday.size).toBe(2);
    expect(context.payStates.size).toBe(2);
  });

  it('finds the codes in the file that are taken outside a country HR user scope', async () => {
    const context = await loadContext(database.db, { kind: 'country', countryCode: 'IN' }, TODAY, [
      'IN-1',
      'US-1',
      'CA-1',
      'NEW-1',
    ]);

    expect([...context.employees.keys()]).toEqual(['IN-1']);
    expect([...context.codesOutsideScope].sort()).toEqual(['CA-1', 'US-1']);
  });

  it('takes files with more employees than a query can have parameters', async () => {
    const codes = Array.from({ length: 70_000 }, (_, index) => `NEW-${String(index)}`);
    const context = await loadContext(database.db, { kind: 'country', countryCode: 'IN' }, TODAY, [
      ...codes,
      'IN-1',
    ]);

    expect([...context.employees.keys()]).toEqual(['IN-1']);
  });
});
