import {
  COUNTRIES,
  annualAmountMinor,
  monthlyEquivalentMinor,
  type CountryCode,
  type CurrencyCode,
  type CurrentPayResponse,
  type CurrentUser,
  type FieldChanges,
  type PayChangeReason,
  type PayChangeRequest,
  type PayFrequencyCode,
  type PayHistoryEntry,
  type PayTotalsResponse,
} from '@salary/shared';
import { todayOn, type Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import type { PayTotals } from '../../db/pay-totals.ts';
import { HttpError, RequestValidationError } from '../../http/errors.ts';
import type { Scope } from '../auth/scope.ts';
import { recordChange } from '../change-log/change-log.ts';
import { findEmployeeOrThrow } from '../employees/employees.repository.ts';
import {
  historyRows,
  itemsOn,
  loadComponents,
  loadPayState,
  lockEmployee,
  payTotalsFor,
  writePayPlan,
  type ComponentDetails,
  type ItemRow,
} from './pay.repository.ts';
import { planPayChange, type PayPlan, type PlanResult } from './pay-rules.ts';

interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

function money(amountMinor: number, currency: CurrencyCode): Money {
  return { amountMinor, currency };
}

/** Totals in the response shape; an employee without pay has zero totals. */
export function toTotalsResponse(
  totals: PayTotals | undefined,
  currency: CurrencyCode,
): PayTotalsResponse {
  return {
    annualTotal: money(totals?.annualTotalMinor ?? 0, currency),
    monthlyTotal: money(totals?.monthlyTotalMinor ?? 0, currency),
    annualGross: money(totals?.annualGrossMinor ?? 0, currency),
    monthlyGross: money(totals?.monthlyGrossMinor ?? 0, currency),
  };
}

/** Today's pay totals for an employee in their country's currency. */
export async function currentTotals(
  db: Database,
  scope: Scope,
  employee: { id: string; countryCode: string },
  clock: Clock,
): Promise<PayTotalsResponse> {
  const { currencyCode } = COUNTRIES[employee.countryCode as CountryCode];
  const totals = await payTotalsFor(db, scope, employee.id, todayOn(clock));
  return toTotalsResponse(totals, currencyCode);
}

export function throwIfInvalid(result: PlanResult): PayPlan {
  if (!result.ok) throw new RequestValidationError(result.issues);
  return result.plan;
}

interface LoggedAmount {
  amountMinor: number;
  currency: CurrencyCode;
  frequency: PayFrequencyCode;
}

/**
 * Change log values of a pay change: its date, reason and note, then each component it touched,
 * named by the component, with the old and new amount (null when added or ended).
 */
export function payChangeLogValues(
  change: { effectiveFrom: string; reason: PayChangeReason; note: string | null },
  ended: readonly (LoggedAmount & { componentId: string })[],
  started: readonly (LoggedAmount & { componentId: string })[],
  components: ReadonlyMap<string, ComponentDetails>,
): FieldChanges {
  const values: FieldChanges = {
    effectiveFrom: { old: null, new: change.effectiveFrom },
    reason: { old: null, new: change.reason },
  };
  if (change.note !== null) values.note = { old: null, new: change.note };
  const logged = ({ amountMinor, currency, frequency }: LoggedAmount) => ({
    amountMinor,
    currency,
    frequency,
  });
  const ids = [...new Set([...ended, ...started].map((item) => item.componentId))];
  for (const id of ids) {
    const before = ended.find((item) => item.componentId === id);
    const after = started.find((item) => item.componentId === id);
    values[components.get(id)?.name ?? id] = {
      old: before ? logged(before) : null,
      new: after ? logged(after) : null,
    };
  }
  return values;
}

/**
 * Writes a planned pay change and its change log entry, inside the caller's transaction. Used by
 * pay changes, starting pay and moves between countries.
 */
export async function savePayPlan(
  tx: Database,
  input: {
    scope: Scope;
    employee: { id: string; countryCode: string };
    effectiveFrom: string;
    reason: PayChangeReason;
    note: string | null;
    plan: PayPlan;
    openItems: readonly (LoggedAmount & { id: string; componentId: string })[];
    actor: CurrentUser;
    clock: Clock;
  },
): Promise<string> {
  const { employee, plan, actor, clock } = input;
  const payChangeId = await writePayPlan(
    tx,
    {
      employeeId: employee.id,
      effectiveFrom: input.effectiveFrom,
      reason: input.reason,
      note: input.note,
      createdBy: actor.id,
      createdAt: clock.now(),
    },
    plan,
  );
  const ended = input.openItems.filter((item) => plan.endItemIds.includes(item.id));
  const components = await loadComponents(tx, input.scope, [
    ...ended.map((item) => item.componentId),
    ...plan.newItems.map((item) => item.componentId),
  ]);
  await recordChange(
    tx,
    {
      entityType: 'pay_change',
      entityId: payChangeId,
      action: 'created',
      changes: payChangeLogValues(input, ended, plan.newItems, components),
      countryCode: employee.countryCode,
      changedBy: actor.id,
    },
    clock,
  );
  return payChangeId;
}

/**
 * Records a pay change for an active employee in the caller's scope: in one transaction the
 * changed and ended items end on the effective date and the new items start (HLD 6.2).
 */
export async function recordPayChange(
  db: Database,
  scope: Scope,
  id: string,
  request: PayChangeRequest,
  actor: CurrentUser,
  clock: Clock,
): Promise<PayHistoryEntry> {
  const payChangeId = await db.transaction(async (tx) => {
    const employee = await lockEmployee(tx, scope, id);
    if (!employee) throw new HttpError(404, 'Employee not found');
    if (employee.status !== 'active') {
      throw new HttpError(409, 'Mark the employee active before changing their pay');
    }
    const state = await loadPayState(tx, scope, employee);
    const components = await loadComponents(tx, scope, [
      ...request.set.map((line) => line.componentId),
      ...request.end,
      ...state.openItems.map((item) => item.componentId),
    ]);
    const plan = throwIfInvalid(planPayChange(state, request, components));
    return savePayPlan(tx, {
      scope,
      employee,
      effectiveFrom: request.effectiveFrom,
      reason: request.reason,
      note: request.note,
      plan,
      openItems: state.openItems,
      actor,
      clock,
    });
  });
  const history = await payHistory(db, scope, id, clock);
  const recorded = history.find((entry) => entry.id === payChangeId);
  if (!recorded) throw new Error('Pay change was not saved');
  return recorded;
}

function periodAmount(item: ItemRow) {
  return {
    amount: money(item.amountMinor, item.currency as CurrencyCode),
    frequency: item.frequency as PayFrequencyCode,
  };
}

function componentRef(item: ItemRow) {
  return {
    id: item.componentId,
    code: item.componentCode,
    name: item.componentName,
    category: item.category,
  };
}

/** Today's items of an employee in the caller's scope, with annual and monthly amounts. */
export async function currentPay(
  db: Database,
  scope: Scope,
  id: string,
  clock: Clock,
): Promise<CurrentPayResponse> {
  const employee = await findEmployeeOrThrow(db, scope, id);
  const today = todayOn(clock);
  const [items, totals] = await Promise.all([
    itemsOn(db, scope, employee.id, today),
    currentTotals(db, scope, employee, clock),
  ]);
  return {
    asOf: today,
    items: items.map((item) => {
      const currency = item.currency as CurrencyCode;
      const annual = annualAmountMinor(item.amountMinor, item.frequency as PayFrequencyCode);
      return {
        id: item.id,
        component: componentRef(item),
        amount: money(item.amountMinor, currency),
        frequency: item.frequency as PayFrequencyCode,
        annualAmount: money(annual, currency),
        monthlyAmount: money(monthlyEquivalentMinor(annual), currency),
        effectiveFrom: item.effectiveFrom,
      };
    }),
    totals,
  };
}

/**
 * The lines of one pay change: each component it started or ended, with the amount before and
 * after. Changes never share a date, so the items that ended on its date are the ones it ended.
 */
export function historyLines(
  change: { id: string; effectiveFrom: string },
  items: readonly ItemRow[],
): PayHistoryEntry['lines'] {
  const started = items.filter((item) => item.payChangeId === change.id);
  const ended = items.filter((item) => item.effectiveTo === change.effectiveFrom);
  const byComponent = new Map<string, PayHistoryEntry['lines'][number]>();
  for (const item of [...ended, ...started]) {
    const line = byComponent.get(item.componentId) ?? {
      component: componentRef(item),
      before: null,
      after: null,
    };
    if (item.payChangeId === change.id) line.after = periodAmount(item);
    else line.before = periodAmount(item);
    byComponent.set(item.componentId, line);
  }
  return [...byComponent.values()].sort((a, b) => a.component.name.localeCompare(b.component.name));
}

/** Every pay change of an employee in the caller's scope, newest first. */
export async function payHistory(
  db: Database,
  scope: Scope,
  id: string,
  clock: Clock,
): Promise<PayHistoryEntry[]> {
  const employee = await findEmployeeOrThrow(db, scope, id);
  const today = todayOn(clock);
  const { changes, items } = await historyRows(db, scope, employee.id);
  return changes.map((change) => ({
    id: change.id,
    effectiveFrom: change.effectiveFrom,
    reason: change.reason,
    note: change.note,
    scheduled: change.effectiveFrom > today,
    createdAt: change.createdAt.toISOString(),
    createdBy:
      change.createdById && change.createdByName
        ? { id: change.createdById, name: change.createdByName }
        : null,
    lines: historyLines(change, items),
  }));
}
