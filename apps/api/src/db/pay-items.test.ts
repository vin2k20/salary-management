import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { componentId, insertEmployee, insertPayChange, insertPayItem } from '../test/fixtures.ts';
import { createTestDatabase, type TestDatabase } from '../test/test-database.ts';

describe('pay changes and pay items', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  async function setUp() {
    const { db } = database;
    const employee = await insertEmployee(db);
    const payChangeId = await insertPayChange(db, employee.id, '2025-04-01');
    const basic = await componentId(db, 'basic', 'IN');
    const item = {
      employeeId: employee.id,
      payChangeId,
      componentId: basic,
      amountMinor: 8_000_000,
      currencyCode: 'INR',
      frequencyCode: 'monthly',
      effectiveFrom: '2025-04-01',
    };
    return { db, item };
  }

  it('stores an ended item and a new open item for the same component', async () => {
    const { db, item } = await setUp();

    await insertPayItem(db, { ...item, effectiveTo: '2026-04-01' });
    await insertPayItem(db, { ...item, amountMinor: 8_800_000, effectiveFrom: '2026-04-01' });
  });

  it('allows only one open item per employee and component', async () => {
    const { db, item } = await setUp();

    await insertPayItem(db, item);
    await expect(insertPayItem(db, { ...item, effectiveFrom: '2026-04-01' })).rejects.toThrow();
  });

  it('rejects a negative amount', async () => {
    const { db, item } = await setUp();

    await expect(insertPayItem(db, { ...item, amountMinor: -1 })).rejects.toThrow();
  });

  it('rejects an end date on or before the start date', async () => {
    const { db, item } = await setUp();

    await expect(insertPayItem(db, { ...item, effectiveTo: '2025-04-01' })).rejects.toThrow();
    await expect(insertPayItem(db, { ...item, effectiveTo: '2025-03-31' })).rejects.toThrow();
  });

  it('rejects an unknown frequency or currency', async () => {
    const { db, item } = await setUp();

    await expect(insertPayItem(db, { ...item, frequencyCode: 'daily' })).rejects.toThrow();
    await expect(insertPayItem(db, { ...item, currencyCode: 'EUR' })).rejects.toThrow();
  });
});
