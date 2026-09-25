import type { Database } from '../db/client.ts';
import { payComponents } from '../db/schema.ts';
import { and, eq } from 'drizzle-orm';
import {
  componentId,
  insertEmployee,
  insertPayChange,
  insertPayItem,
  insertRates,
} from './fixtures.ts';

type EmployeeOverrides = Parameters<typeof insertEmployee>[1];

interface PayLine {
  component: string;
  amountMinor: number;
  frequency?: string;
}

const CURRENCY: Record<string, string> = { IN: 'INR', US: 'USD', CA: 'CAD', AU: 'AUD' };

/** The country's own component with the code, or the all-country one. */
async function componentFor(db: Database, code: string, countryCode: string) {
  const [own] = await db
    .select({ id: payComponents.id })
    .from(payComponents)
    .where(and(eq(payComponents.code, code), eq(payComponents.countryCode, countryCode)));
  return own?.id ?? componentId(db, code, null);
}

/**
 * Inserts an employee hired on 1 Jan 2025 with pay items from that date, yearly unless a line
 * says otherwise, so annual amounts equal the amounts given.
 */
export async function insertPaidEmployee(
  db: Database,
  employee: EmployeeOverrides,
  lines: PayLine[],
) {
  const inserted = await insertEmployee(db, { hireDate: '2025-01-01', ...employee });
  const changeId = await insertPayChange(db, inserted.id, '2025-01-01');
  for (const line of lines) {
    await insertPayItem(db, {
      employeeId: inserted.id,
      payChangeId: changeId,
      componentId: await componentFor(db, line.component, inserted.countryCode),
      amountMinor: line.amountMinor,
      currencyCode: CURRENCY[inserted.countryCode] ?? 'USD',
      frequencyCode: line.frequency ?? 'yearly',
      effectiveFrom: '2025-01-01',
    });
  }
  return inserted;
}

const engineer = {
  department: 'Engineering',
  jobTitle: 'Software Engineer',
  employmentType: 'full_time',
} as const;
const accountExecutive = { department: 'Sales', jobTitle: 'Account Executive' } as const;

/**
 * A small organisation with known answers, with rates of 24 Sep 2026. Annual pay in minor units:
 *
 * India (INR): six software engineers paid 105,000,000 (100,000,000 basic plus 5,000,000
 * employer PF), 110,000,001, 120,000,000, 130,000,000, 140,000,000 and 200,000,000; two account
 * executives paid 80,000,000 and 300,000,001; an inactive engineer paid 900,000,000; and an
 * engineer with no pay yet.
 *
 * USA (USD): five software engineers paid 9,500,000, 12,000,000 (three) and 15,000,000, and a
 * contractor account executive paid 1,000,000 a month. Canada (CAD): one engineer paid 9,000,000.
 */
export async function insertInsightsData(db: Database) {
  await insertRates(db);
  const india = { countryCode: 'IN', region: 'Karnataka' } as const;
  await insertPaidEmployee(db, { ...india, ...engineer, employeeCode: 'IN-E1' }, [
    { component: 'basic', amountMinor: 100_000_000 },
    { component: 'employer_pf', amountMinor: 5_000_000 },
  ]);
  for (const [code, amountMinor] of [
    ['IN-E2', 110_000_001],
    ['IN-E3', 120_000_000],
    ['IN-E4', 130_000_000],
    ['IN-E5', 140_000_000],
    ['IN-E6', 200_000_000],
  ] as const) {
    await insertPaidEmployee(db, { ...india, ...engineer, employeeCode: code }, [
      { component: 'basic', amountMinor },
    ]);
  }
  for (const [code, amountMinor] of [
    ['IN-S1', 80_000_000],
    ['IN-S2', 300_000_001],
  ] as const) {
    await insertPaidEmployee(db, { ...india, ...accountExecutive, employeeCode: code }, [
      { component: 'basic', amountMinor },
    ]);
  }
  await insertPaidEmployee(
    db,
    {
      ...india,
      ...engineer,
      employeeCode: 'IN-X1',
      status: 'inactive',
      inactiveOn: '2026-06-30',
    },
    [{ component: 'basic', amountMinor: 900_000_000 }],
  );
  await insertEmployee(db, {
    ...india,
    ...engineer,
    employeeCode: 'IN-N1',
    hireDate: '2025-01-01',
  });

  const usa = { countryCode: 'US', region: 'California' } as const;
  for (const [code, amountMinor] of [
    ['US-E1', 9_500_000],
    ['US-E2', 12_000_000],
    ['US-E3', 12_000_000],
    ['US-E4', 12_000_000],
    ['US-E5', 15_000_000],
  ] as const) {
    await insertPaidEmployee(db, { ...usa, ...engineer, employeeCode: code }, [
      { component: 'base_salary', amountMinor },
    ]);
  }
  await insertPaidEmployee(
    db,
    { ...usa, ...accountExecutive, employeeCode: 'US-C1', employmentType: 'contractor' },
    [{ component: 'contract_fee', amountMinor: 1_000_000, frequency: 'monthly' }],
  );

  await insertPaidEmployee(
    db,
    { countryCode: 'CA', region: 'Ontario', ...engineer, employeeCode: 'CA-E1' },
    [{ component: 'base_salary', amountMinor: 9_000_000 }],
  );
}

/** The rates insertRates stores, for working out expected conversions in tests. */
export const TEST_RATES = { USD: '1', CAD: '1.4117', AUD: '1.4232', INR: '95.96' } as const;
