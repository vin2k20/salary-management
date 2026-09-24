import type {
  CountryCode,
  CurrencyCode,
  PayChangeReason,
  PayComponentCategory,
  PayFrequencyCode,
} from '@salary/shared';
import { and, asc, desc, eq, gt, inArray, isNull, lte, max, or, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { toPayTotals, type PayTotals, type PayTotalsRow } from '../../db/pay-totals.ts';
import { employees, payChanges, payComponents, payItems, users } from '../../db/schema.ts';
import { scopeCondition, type Scope } from '../auth/scope.ts';
import type { ComponentInfo, NewItem, OpenItem, PayPlan, PayState } from './pay-rules.ts';

/**
 * An employee in the caller's scope, locked until the transaction ends, so two pay changes for
 * the same employee cannot interleave.
 */
export async function lockEmployee(db: Database, scope: Scope, id: string) {
  const [row] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), scopeCondition(scope, employees.countryCode)))
    .for('update');
  return row;
}

/** Components in the caller's scope: all of them, or a country's own and all-country ones. */
function componentsInScope(scope: Scope) {
  return scope.kind === 'all'
    ? undefined
    : or(eq(payComponents.countryCode, scope.countryCode), isNull(payComponents.countryCode));
}

/** Open items and the date of the latest pay change, for the pay change rules. */
export async function loadPayState(
  db: Database,
  scope: Scope,
  employee: { id: string; countryCode: string; hireDate: string },
): Promise<PayState & { openItems: (OpenItem & { currency: CurrencyCode })[] }> {
  const [openRows, [latest]] = await Promise.all([
    db
      .select({ item: payItems })
      .from(payItems)
      .innerJoin(employees, eq(employees.id, payItems.employeeId))
      .where(
        and(
          eq(payItems.employeeId, employee.id),
          isNull(payItems.effectiveTo),
          scopeCondition(scope, employees.countryCode),
        ),
      ),
    db
      .select({ date: max(payChanges.effectiveFrom) })
      .from(payChanges)
      .innerJoin(employees, eq(employees.id, payChanges.employeeId))
      .where(
        and(eq(payChanges.employeeId, employee.id), scopeCondition(scope, employees.countryCode)),
      ),
  ]);
  return {
    countryCode: employee.countryCode as CountryCode,
    hireDate: employee.hireDate,
    latestChangeDate: latest?.date ?? null,
    openItems: openRows.map(({ item: row }) => ({
      id: row.id,
      componentId: row.componentId,
      amountMinor: row.amountMinor,
      currency: row.currencyCode as CurrencyCode,
      frequency: row.frequencyCode as PayFrequencyCode,
    })),
  };
}

export interface ComponentDetails extends ComponentInfo {
  code: string;
  category: PayComponentCategory;
}

/** The named components in the caller's scope, by ID. Unknown IDs are left out. */
export async function loadComponents(
  db: Database,
  scope: Scope,
  ids: readonly string[],
): Promise<Map<string, ComponentDetails>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select()
    .from(payComponents)
    .where(and(inArray(payComponents.id, [...new Set(ids)]), componentsInScope(scope)));
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        code: row.code,
        name: row.name,
        category: row.category,
        countryCode: row.countryCode as CountryCode | null,
        isActive: row.isActive,
      },
    ]),
  );
}

/**
 * Saves a planned pay change: the change itself, the ended items and the new items. The plan's
 * item IDs come from reads scoped to the caller in the same transaction.
 */
export async function writePayPlan(
  db: Database,
  change: {
    employeeId: string;
    effectiveFrom: string;
    reason: PayChangeReason;
    note: string | null;
    createdBy: string;
    createdAt: Date;
  },
  plan: PayPlan,
): Promise<string> {
  const [inserted] = await db.insert(payChanges).values(change).returning({ id: payChanges.id });
  if (!inserted) throw new Error('Pay change was not inserted');
  if (plan.endItemIds.length > 0) {
    await db
      .update(payItems)
      .set({ effectiveTo: change.effectiveFrom })
      .where(inArray(payItems.id, plan.endItemIds));
  }
  if (plan.newItems.length > 0) {
    await db.insert(payItems).values(
      plan.newItems.map((item: NewItem) => ({
        employeeId: change.employeeId,
        payChangeId: inserted.id,
        componentId: item.componentId,
        amountMinor: item.amountMinor,
        currencyCode: item.currency,
        frequencyCode: item.frequency,
        effectiveFrom: change.effectiveFrom,
      })),
    );
  }
  return inserted.id;
}

const itemColumns = {
  id: payItems.id,
  payChangeId: payItems.payChangeId,
  componentId: payComponents.id,
  componentCode: payComponents.code,
  componentName: payComponents.name,
  category: payComponents.category,
  amountMinor: payItems.amountMinor,
  currency: payItems.currencyCode,
  frequency: payItems.frequencyCode,
  effectiveFrom: payItems.effectiveFrom,
  effectiveTo: payItems.effectiveTo,
};

/** Items that apply on a date: effective_from <= date < effective_to, by component name. */
export async function itemsOn(db: Database, scope: Scope, employeeId: string, date: string) {
  return db
    .select(itemColumns)
    .from(payItems)
    .innerJoin(payComponents, eq(payComponents.id, payItems.componentId))
    .innerJoin(employees, eq(employees.id, payItems.employeeId))
    .where(
      and(
        eq(payItems.employeeId, employeeId),
        scopeCondition(scope, employees.countryCode),
        lte(payItems.effectiveFrom, date),
        or(isNull(payItems.effectiveTo), gt(payItems.effectiveTo, date)),
      ),
    )
    .orderBy(asc(payComponents.name));
}

export type ItemRow = Awaited<ReturnType<typeof itemsOn>>[number];

/** Every pay change of an employee, newest first, and all their items. */
export async function historyRows(db: Database, scope: Scope, employeeId: string) {
  const inScope = scopeCondition(scope, employees.countryCode);
  const [changes, items] = await Promise.all([
    db
      .select({
        id: payChanges.id,
        effectiveFrom: payChanges.effectiveFrom,
        reason: payChanges.reason,
        note: payChanges.note,
        createdAt: payChanges.createdAt,
        createdById: users.id,
        createdByName: users.name,
      })
      .from(payChanges)
      .leftJoin(users, eq(users.id, payChanges.createdBy))
      .innerJoin(employees, eq(employees.id, payChanges.employeeId))
      .where(and(eq(payChanges.employeeId, employeeId), inScope))
      .orderBy(desc(payChanges.effectiveFrom), desc(payChanges.createdAt)),
    db
      .select(itemColumns)
      .from(payItems)
      .innerJoin(payComponents, eq(payComponents.id, payItems.componentId))
      .innerJoin(employees, eq(employees.id, payItems.employeeId))
      .where(and(eq(payItems.employeeId, employeeId), inScope))
      .orderBy(asc(payComponents.name)),
  ]);
  return { changes, items };
}

/** Pay totals for one employee in the caller's scope on a date, from pay_totals_on. */
export async function payTotalsFor(
  db: Database,
  scope: Scope,
  employeeId: string,
  date: string,
): Promise<PayTotals | undefined> {
  const inScope = scopeCondition(scope, employees.countryCode);
  const result = await db.execute(sql`
    select totals.*
    from pay_totals_on(${date}::date) as totals
    join ${employees} on ${employees.id} = totals.employee_id
    where totals.employee_id = ${employeeId} ${inScope ? sql`and ${inScope}` : sql``}
  `);
  // Both drivers return the rows in `rows`; the shared database type leaves the result untyped.
  const [row] = (result as { rows: PayTotalsRow[] }).rows;
  return row ? toPayTotals(row) : undefined;
}
