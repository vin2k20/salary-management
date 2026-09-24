import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { employees, fxRates, payChanges, payComponents, payItems, users } from '../db/schema.ts';

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

/** Inserts an employee and returns it. */
export async function insertEmployee(db: Database, overrides: Partial<NewEmployee> = {}) {
  const [employee] = await db.insert(employees).values(employeeValues(overrides)).returning();
  if (!employee) throw new Error('Employee was not inserted');
  return employee;
}

/** Looks up a system pay component by code, for one country or all countries (null). */
export async function componentId(db: Database, code: string, countryCode: string | null) {
  const [component] = await db
    .select({ id: payComponents.id })
    .from(payComponents)
    .where(
      and(
        eq(payComponents.code, code),
        countryCode === null
          ? isNull(payComponents.countryCode)
          : eq(payComponents.countryCode, countryCode),
      ),
    );
  if (!component) throw new Error(`No pay component ${code} for ${String(countryCode)}`);
  return component.id;
}

/** Inserts a pay change for an employee and returns its ID. */
export async function insertPayChange(
  db: Database,
  employeeId: string,
  effectiveFrom: string,
  reason: typeof payChanges.$inferInsert.reason = 'hire',
) {
  const [change] = await db
    .insert(payChanges)
    .values({ employeeId, effectiveFrom, reason })
    .returning({ id: payChanges.id });
  if (!change) throw new Error('Pay change was not inserted');
  return change.id;
}

type NewPayItem = typeof payItems.$inferInsert;

/** Inserts a pay item. */
export async function insertPayItem(db: Database, values: NewPayItem) {
  await db.insert(payItems).values(values);
}

/** Inserts an HR user. Without a password hash the user cannot sign in. */
export async function insertUser(db: Database, overrides: Partial<typeof users.$inferInsert> = {}) {
  sequence += 1;
  const [user] = await db
    .insert(users)
    .values({
      email: `user${String(sequence)}@acme.example.com`,
      name: `Test User ${String(sequence)}`,
      role: 'global_hr',
      ...overrides,
    })
    .returning();
  if (!user) throw new Error('User was not inserted');
  return user;
}

/** Stores exchange rates for a date; the defaults are the Frankfurter rates of 24 Sep 2026. */
export async function insertRates(
  db: Database,
  rateDate = '2026-09-24',
  rates: Record<string, string> = { USD: '1', CAD: '1.4117', AUD: '1.4232', INR: '95.96' },
) {
  await db
    .insert(fxRates)
    .values(
      Object.entries(rates).map(([currencyCode, unitsPerUsd]) => ({
        currencyCode,
        unitsPerUsd,
        rateDate,
        source: 'test',
      })),
    )
    .onConflictDoNothing();
}

/**
 * Inserts an employee with one open pay item, hired and paid from 1 Jan 2025. The component must
 * exist for the employee's country (or all countries).
 */
export async function insertEmployeeWithPay(
  db: Database,
  employee: Partial<NewEmployee>,
  pay: { component: string; amountMinor: number; frequency: string; currency: string },
) {
  const inserted = await insertEmployee(db, { hireDate: '2025-01-01', ...employee });
  const changeId = await insertPayChange(db, inserted.id, '2025-01-01');
  const countryComponent = await db
    .select({ id: payComponents.id })
    .from(payComponents)
    .where(
      and(
        eq(payComponents.code, pay.component),
        eq(payComponents.countryCode, inserted.countryCode),
      ),
    );
  const component = countryComponent[0]?.id ?? (await componentId(db, pay.component, null));
  await insertPayItem(db, {
    employeeId: inserted.id,
    payChangeId: changeId,
    componentId: component,
    amountMinor: pay.amountMinor,
    currencyCode: pay.currency,
    frequencyCode: pay.frequency,
    effectiveFrom: '2025-01-01',
  });
  return inserted;
}
