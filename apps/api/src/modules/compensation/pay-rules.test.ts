import type { CurrencyCode, PayFrequencyCode, PayLine } from '@salary/shared';
import { describe, expect, it } from 'vitest';
import { planPayChange, planTransfer, type ComponentInfo, type PayState } from './pay-rules.ts';

const ids = {
  basic: '10000000-0000-4000-8000-000000000001',
  hra: '10000000-0000-4000-8000-000000000002',
  lta: '10000000-0000-4000-8000-000000000003',
  oldAllowance: '10000000-0000-4000-8000-000000000004',
  usBase: '10000000-0000-4000-8000-000000000005',
  contractFee: '10000000-0000-4000-8000-000000000006',
};

const components = new Map<string, ComponentInfo>([
  [ids.basic, { id: ids.basic, name: 'Basic', countryCode: 'IN', isActive: true }],
  [ids.hra, { id: ids.hra, name: 'House rent allowance', countryCode: 'IN', isActive: true }],
  [ids.lta, { id: ids.lta, name: 'Leave travel allowance', countryCode: 'IN', isActive: true }],
  [
    ids.oldAllowance,
    { id: ids.oldAllowance, name: 'Old allowance', countryCode: 'IN', isActive: false },
  ],
  [ids.usBase, { id: ids.usBase, name: 'Base salary or wages', countryCode: 'US', isActive: true }],
  [
    ids.contractFee,
    { id: ids.contractFee, name: 'Contract fee', countryCode: null, isActive: true },
  ],
]);

const state: PayState = {
  countryCode: 'IN',
  hireDate: '2024-04-01',
  latestChangeDate: '2025-04-01',
  openItems: [
    { id: 'item-basic', componentId: ids.basic, amountMinor: 5_000_000, frequency: 'monthly' },
    { id: 'item-hra', componentId: ids.hra, amountMinor: 2_000_000, frequency: 'monthly' },
  ],
};

function line(
  componentId: string,
  amount: string,
  frequency: PayFrequencyCode = 'monthly',
  currency: CurrencyCode = 'INR',
): PayLine {
  return { componentId, amount, currency, frequency };
}

describe('planPayChange', () => {
  it('ends the items it changes or ends, and starts new items in minor units', () => {
    const result = planPayChange(
      state,
      {
        effectiveFrom: '2026-04-01',
        set: [line(ids.basic, '55000'), line(ids.lta, '40000.50', 'yearly')],
        end: [ids.hra],
      },
      components,
    );

    expect(result).toEqual({
      ok: true,
      plan: {
        endItemIds: ['item-basic', 'item-hra'],
        newItems: [
          { componentId: ids.basic, amountMinor: 5_500_000, currency: 'INR', frequency: 'monthly' },
          { componentId: ids.lta, amountMinor: 4_000_050, currency: 'INR', frequency: 'yearly' },
        ],
      },
    });
  });

  it('accepts components used in all countries', () => {
    const result = planPayChange(
      state,
      { effectiveFrom: '2026-04-01', set: [line(ids.contractFee, '1000')], end: [] },
      components,
    );

    expect(result.ok).toBe(true);
  });

  it('needs a date after the last pay change, and never before the hire date', () => {
    const sameDay = planPayChange(
      state,
      { effectiveFrom: '2025-04-01', set: [line(ids.basic, '55000')], end: [] },
      components,
    );
    const beforeHire = planPayChange(
      { ...state, latestChangeDate: null, openItems: [] },
      { effectiveFrom: '2024-03-31', set: [line(ids.basic, '55000')], end: [] },
      components,
    );

    expect(sameDay).toEqual({
      ok: false,
      issues: [
        { field: 'effectiveFrom', message: "Choose a date after the employee's last pay change" },
      ],
    });
    expect(beforeHire).toEqual({
      ok: false,
      issues: [{ field: 'effectiveFrom', message: 'Pay cannot start before the hire date' }],
    });
  });

  it('rejects components from another country, inactive or unknown ones, and other currencies', () => {
    const result = planPayChange(
      state,
      {
        effectiveFrom: '2026-04-01',
        set: [
          line(ids.usBase, '4000'),
          line(ids.oldAllowance, '100'),
          line('10000000-0000-4000-8000-000000000099', '100'),
          line(ids.lta, '100', 'yearly', 'USD'),
        ],
        end: [],
      },
      components,
    );

    expect(result).toEqual({
      ok: false,
      issues: [
        { field: 'set.0.componentId', message: 'Base salary or wages is not used in India' },
        { field: 'set.1.componentId', message: 'Old allowance is no longer in use' },
        { field: 'set.2.componentId', message: 'Choose a component' },
        { field: 'set.3.currency', message: 'Pay for employees in India is in INR' },
      ],
    });
  });

  it('rejects a change that keeps the same amount and frequency', () => {
    const result = planPayChange(
      state,
      { effectiveFrom: '2026-04-01', set: [line(ids.basic, '50000.00')], end: [] },
      components,
    );

    expect(result).toEqual({
      ok: false,
      issues: [{ field: 'set.0.amount', message: 'Basic already has this amount and frequency' }],
    });
  });

  it('ends only components that are part of current pay', () => {
    const result = planPayChange(
      state,
      { effectiveFrom: '2026-04-01', set: [], end: [ids.lta] },
      components,
    );

    expect(result).toEqual({
      ok: false,
      issues: [{ field: 'end.0', message: 'Leave travel allowance is not part of current pay' }],
    });
  });
});

describe('planTransfer', () => {
  const move = {
    countryCode: 'US' as const,
    region: 'Texas',
    countryFields: {},
    effectiveFrom: '2026-09-24',
    items: [line(ids.usBase, '4000.00', 'bi_weekly', 'USD')],
  };

  it('ends every current item and starts the new pay', () => {
    expect(planTransfer(state, move, components, '2026-09-24')).toEqual({
      ok: true,
      plan: {
        endItemIds: ['item-basic', 'item-hra'],
        newItems: [
          {
            componentId: ids.usBase,
            amountMinor: 400_000,
            currency: 'USD',
            frequency: 'bi_weekly',
          },
        ],
      },
    });
  });

  it('needs another country, a date up to today and components of the new country', () => {
    expect(
      planTransfer(
        state,
        {
          ...move,
          countryCode: 'IN',
          region: 'Kerala',
          items: [line(ids.basic, '100')],
        },
        components,
        '2026-09-24',
      ),
    ).toEqual({
      ok: false,
      issues: [{ field: 'countryCode', message: 'Choose a country other than India' }],
    });
    expect(
      planTransfer(
        state,
        { ...move, effectiveFrom: '2026-09-25', items: [line(ids.basic, '100', 'monthly', 'USD')] },
        components,
        '2026-09-24',
      ),
    ).toEqual({
      ok: false,
      issues: [
        { field: 'effectiveFrom', message: 'A move cannot be dated in the future' },
        { field: 'items.0.componentId', message: 'Basic is not used in United States' },
      ],
    });
  });
});
