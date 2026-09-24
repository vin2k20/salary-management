import {
  COUNTRIES,
  payLineIssues,
  positiveMinorUnits,
  type CountryCode,
  type CurrencyCode,
  type PayFrequencyCode,
  type PayLine,
  type TransferRequest,
} from '@salary/shared';
import type { FieldError } from '../../http/errors.ts';

/**
 * Pay change rules as plain functions (HLD 6.2). They decide which open items end and which new
 * items start; the service then writes that plan in one transaction.
 */

export interface OpenItem {
  id: string;
  componentId: string;
  amountMinor: number;
  frequency: PayFrequencyCode;
}

/** What the rules need to know about an employee's pay. */
export interface PayState {
  countryCode: CountryCode;
  hireDate: string;
  /** Effective date of the latest pay change, including scheduled ones, or null for none. */
  latestChangeDate: string | null;
  /** Items with no end date, one per component. */
  openItems: OpenItem[];
}

export interface ComponentInfo {
  id: string;
  name: string;
  /** Null for components used in all countries. */
  countryCode: CountryCode | null;
  isActive: boolean;
}

export interface NewItem {
  componentId: string;
  amountMinor: number;
  currency: CurrencyCode;
  frequency: PayFrequencyCode;
}

export interface PayPlan {
  /** Open items that end on the effective date. */
  endItemIds: string[];
  /** Items that start on the effective date. */
  newItems: NewItem[];
}

export type PlanResult = { ok: true; plan: PayPlan } | { ok: false; issues: FieldError[] };

/**
 * A change must come after the latest one, so items never overlap, and pay never starts before
 * the hire date.
 */
function dateIssues(state: PayState, effectiveFrom: string): FieldError[] {
  if (state.latestChangeDate !== null && effectiveFrom <= state.latestChangeDate) {
    return [
      { field: 'effectiveFrom', message: "Choose a date after the employee's last pay change" },
    ];
  }
  if (effectiveFrom < state.hireDate) {
    return [{ field: 'effectiveFrom', message: 'Pay cannot start before the hire date' }];
  }
  return [];
}

/**
 * Checks new pay lines for a country: known, active components used there, in the country's
 * currency. `key` names the field that holds the lines.
 */
function lineIssues(
  countryCode: CountryCode,
  lines: readonly PayLine[],
  components: ReadonlyMap<string, ComponentInfo>,
  key: string,
): FieldError[] {
  const issues: FieldError[] = [];
  lines.forEach((line, index) => {
    const component = components.get(line.componentId);
    const field = `${key}.${String(index)}.componentId`;
    if (!component) {
      issues.push({ field, message: 'Choose a component' });
    } else if (component.countryCode !== null && component.countryCode !== countryCode) {
      issues.push({
        field,
        message: `${component.name} is not used in ${COUNTRIES[countryCode].name}`,
      });
    } else if (!component.isActive) {
      issues.push({ field, message: `${component.name} is no longer in use` });
    }
  });
  for (const issue of payLineIssues(countryCode, lines, key)) {
    issues.push({ field: issue.path.join('.'), message: issue.message });
  }
  return issues;
}

function toNewItems(lines: readonly PayLine[]): NewItem[] {
  return lines.map((line) => ({
    componentId: line.componentId,
    // Checked by the shared schema, so the amount is always a positive amount here.
    amountMinor: positiveMinorUnits(line.amount, line.currency) ?? 0,
    currency: line.currency,
    frequency: line.frequency,
  }));
}

/**
 * Plans a pay change: the open item of each changed or ended component ends on the effective
 * date, and each set component starts a new item. Starting pay for a new employee is a change
 * with no open items and no earlier change.
 */
export function planPayChange(
  state: PayState,
  change: { effectiveFrom: string; set: readonly PayLine[]; end: readonly string[] },
  components: ReadonlyMap<string, ComponentInfo>,
): PlanResult {
  const openByComponent = new Map(state.openItems.map((item) => [item.componentId, item]));
  const newItems = toNewItems(change.set);
  const issues = [
    ...dateIssues(state, change.effectiveFrom),
    ...lineIssues(state.countryCode, change.set, components, 'set'),
  ];

  newItems.forEach((item, index) => {
    const open = openByComponent.get(item.componentId);
    if (open?.amountMinor === item.amountMinor && open.frequency === item.frequency) {
      const name = components.get(item.componentId)?.name ?? 'This component';
      issues.push({
        field: `set.${String(index)}.amount`,
        message: `${name} already has this amount and frequency`,
      });
    }
  });
  change.end.forEach((componentId, index) => {
    if (!openByComponent.has(componentId)) {
      const name = components.get(componentId)?.name ?? 'This component';
      issues.push({ field: `end.${String(index)}`, message: `${name} is not part of current pay` });
    }
  });
  if (issues.length > 0) return { ok: false, issues };

  const changed = new Set([...change.set.map((line) => line.componentId), ...change.end]);
  return {
    ok: true,
    plan: {
      endItemIds: state.openItems
        .filter((item) => changed.has(item.componentId))
        .map((item) => item.id),
      newItems,
    },
  };
}

/**
 * Plans a move to another country (D35): every open item ends on the effective date and the new
 * pay starts in the new country's currency. A move cannot be dated in the future, since the
 * employee's country changes at once.
 */
export function planTransfer(
  state: PayState,
  move: TransferRequest,
  components: ReadonlyMap<string, ComponentInfo>,
  today: string,
): PlanResult {
  if (move.countryCode === state.countryCode) {
    return {
      ok: false,
      issues: [
        {
          field: 'countryCode',
          message: `Choose a country other than ${COUNTRIES[state.countryCode].name}`,
        },
      ],
    };
  }
  const issues = [
    ...(move.effectiveFrom > today
      ? [{ field: 'effectiveFrom', message: 'A move cannot be dated in the future' }]
      : dateIssues(state, move.effectiveFrom)),
    ...lineIssues(move.countryCode, move.items, components, 'items'),
  ];
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    plan: {
      endItemIds: state.openItems.map((item) => item.id),
      newItems: toNewItems(move.items),
    },
  };
}
