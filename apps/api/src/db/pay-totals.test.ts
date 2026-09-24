import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { componentId, insertEmployee, insertPayChange, insertPayItem } from '../test/fixtures.ts';
import { createTestDatabase, type TestDatabase } from '../test/test-database.ts';
import { payTotalsOn } from './pay-totals.ts';

describe('pay totals', () => {
  let database: TestDatabase;
  let indiaEmployeeId: string;
  let usEmployeeId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    const { db } = database;

    // India: monthly basic, a raised HRA, a future special allowance, employer PF and a yearly bonus.
    const india = await insertEmployee(db, { countryCode: 'IN' });
    indiaEmployeeId = india.id;
    const hire = await insertPayChange(db, india.id, '2025-04-01');
    const raise = await insertPayChange(db, india.id, '2026-04-01', 'revision');
    const future = await insertPayChange(db, india.id, '2026-10-01', 'promotion');
    const item = {
      employeeId: india.id,
      currencyCode: 'INR',
      frequencyCode: 'monthly',
    };
    await insertPayItem(db, {
      ...item,
      payChangeId: hire,
      componentId: await componentId(db, 'basic', 'IN'),
      amountMinor: 8_000_000,
      effectiveFrom: '2025-04-01',
    });
    const hra = await componentId(db, 'hra', 'IN');
    await insertPayItem(db, {
      ...item,
      payChangeId: hire,
      componentId: hra,
      amountMinor: 4_000_000,
      effectiveFrom: '2025-04-01',
      effectiveTo: '2026-04-01',
    });
    await insertPayItem(db, {
      ...item,
      payChangeId: raise,
      componentId: hra,
      amountMinor: 4_400_000,
      effectiveFrom: '2026-04-01',
    });
    await insertPayItem(db, {
      ...item,
      payChangeId: future,
      componentId: await componentId(db, 'special_allowance', 'IN'),
      amountMinor: 1_000_000,
      effectiveFrom: '2026-10-01',
    });
    await insertPayItem(db, {
      ...item,
      payChangeId: hire,
      componentId: await componentId(db, 'employer_pf', 'IN'),
      amountMinor: 180_000,
      effectiveFrom: '2025-04-01',
    });
    await insertPayItem(db, {
      ...item,
      payChangeId: hire,
      componentId: await componentId(db, 'performance_bonus', 'IN'),
      amountMinor: 10_000_000,
      frequencyCode: 'yearly',
      effectiveFrom: '2025-04-01',
    });

    // United States: pay that ended before the date asked about.
    const us = await insertEmployee(db, { countryCode: 'US', region: 'California' });
    usEmployeeId = us.id;
    const usHire = await insertPayChange(db, us.id, '2024-01-01');
    await insertPayItem(db, {
      employeeId: us.id,
      payChangeId: usHire,
      componentId: await componentId(db, 'base_salary', 'US'),
      amountMinor: 384_615,
      currencyCode: 'USD',
      frequencyCode: 'bi_weekly',
      effectiveFrom: '2024-01-01',
      effectiveTo: '2026-01-01',
    });
  });

  afterAll(async () => {
    await database.close();
  });

  async function totalsFor(employeeId: string, date: string) {
    const totals = await payTotalsOn(database.db, date);
    return totals.find((row) => row.employeeId === employeeId);
  }

  it('adds up current items as annual totals in local currency', async () => {
    // 80,000 + 44,000 + 1,800 monthly, plus a 100,000 yearly bonus (INR).
    expect(await totalsFor(indiaEmployeeId, '2026-09-24')).toEqual({
      employeeId: indiaEmployeeId,
      currencyCode: 'INR',
      annualTotalMinor: 160_960_000,
      annualGrossMinor: 158_800_000,
      monthlyTotalMinor: 13_413_333,
      monthlyGrossMinor: 13_233_333,
    });
  });

  it('leaves employer contributions out of gross pay', async () => {
    const totals = await totalsFor(indiaEmployeeId, '2026-09-24');
    // Employer PF: 1,800 a month.
    expect((totals?.annualTotalMinor ?? 0) - (totals?.annualGrossMinor ?? 0)).toBe(2_160_000);
  });

  it('uses the item that applied on the date, ignoring ended and future-dated items', async () => {
    // Before the HRA raise: HRA 40,000 instead of 44,000.
    expect((await totalsFor(indiaEmployeeId, '2026-03-31'))?.annualTotalMinor).toBe(156_160_000);
    // On the day the future allowance starts, it counts: 10,000 a month more.
    expect((await totalsFor(indiaEmployeeId, '2026-10-01'))?.annualTotalMinor).toBe(172_960_000);
  });

  it('lists employees with no current pay with zero totals', async () => {
    expect(await totalsFor(usEmployeeId, '2026-09-24')).toMatchObject({
      currencyCode: 'USD',
      annualTotalMinor: 0,
      annualGrossMinor: 0,
    });
    expect((await totalsFor(usEmployeeId, '2025-06-01'))?.annualTotalMinor).toBe(384_615 * 26);
  });

  it('has a current_pay_totals view for today', async () => {
    const { rows } = await database.client.query<{ count: number }>(
      'select count(*)::int as count from current_pay_totals',
    );
    expect(rows[0]?.count).toBe(2);
    await expect(database.db.execute(sql`select * from current_pay_totals`)).resolves.toBeDefined();
  });
});
