import { describe, expect, it } from 'vitest';
import { createEmployeeRequestSchema } from './employee-record.ts';
import { payLineSchema } from './pay-lines.ts';
import { payChangeRequestSchema, transferRequestSchema } from './pay.ts';

const basic = '0b7f3c52-5a1e-4c1e-9d8a-6f1c2a4e8b01';
const hra = '0b7f3c52-5a1e-4c1e-9d8a-6f1c2a4e8b02';

function issuesOf(result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return result.error?.issues.map((issue) => [issue.path.join('.'), issue.message]) ?? [];
}

describe('payLineSchema', () => {
  const line = { componentId: basic, amount: '55000.50', currency: 'INR', frequency: 'monthly' };

  it('accepts an amount per period as a decimal string', () => {
    expect(payLineSchema.parse({ ...line, amount: ' 55000.50 ' })).toEqual(line);
    expect(payLineSchema.safeParse({ ...line, amount: '100' }).success).toBe(true);
  });

  it('rejects amounts that are not positive, have too many decimals or are not numbers', () => {
    for (const amount of ['0', '0.00', '-5', '12.345', 'abc', '']) {
      expect(issuesOf(payLineSchema.safeParse({ ...line, amount })), amount).toEqual([
        ['amount', 'Enter an amount above zero, such as 1250.50'],
      ]);
    }
  });

  it('asks for a component, a currency and one of the eight frequencies', () => {
    expect(
      issuesOf(
        payLineSchema.safeParse({
          componentId: '',
          amount: '1',
          currency: 'EUR',
          frequency: 'daily',
        }),
      ),
    ).toEqual([
      ['componentId', 'Choose a component'],
      ['currency', 'Choose a currency'],
      ['frequency', 'Choose how often it is paid'],
    ]);
  });
});

describe('payChangeRequestSchema', () => {
  const change = {
    effectiveFrom: '2026-10-01',
    reason: 'revision',
    set: [{ componentId: basic, amount: '60000', currency: 'INR', frequency: 'monthly' }],
    end: [hra],
  };

  it('accepts components to set and to end, with an optional note', () => {
    expect(payChangeRequestSchema.parse({ ...change, note: ' Annual review ' })).toEqual({
      ...change,
      note: 'Annual review',
    });
    expect(payChangeRequestSchema.parse({ ...change, note: '' })).toEqual({
      ...change,
      note: null,
    });
  });

  it('needs at least one component to set or end', () => {
    expect(issuesOf(payChangeRequestSchema.safeParse({ ...change, set: [], end: [] }))).toEqual([
      ['set', 'Change, add or end at least one component'],
    ]);
  });

  it('lists each component once', () => {
    expect(issuesOf(payChangeRequestSchema.safeParse({ ...change, end: [basic] }))).toEqual([
      ['end.0', 'Each component can appear only once in a pay change'],
    ]);
  });

  it('allows only the reasons HR records by hand', () => {
    for (const reason of ['promotion', 'revision', 'correction']) {
      expect(payChangeRequestSchema.safeParse({ ...change, reason }).success).toBe(true);
    }
    for (const reason of ['hire', 'transfer', 'import']) {
      expect(issuesOf(payChangeRequestSchema.safeParse({ ...change, reason }))).toEqual([
        ['reason', 'Choose a reason'],
      ]);
    }
  });
});

describe('starting pay on a new employee', () => {
  const employee = {
    employeeCode: 'IN00042',
    firstName: 'Aarav',
    lastName: 'Sharma',
    email: 'aarav.sharma@acme.example.com',
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    countryCode: 'IN',
    region: 'Karnataka',
    employmentType: 'full_time',
    hireDate: '2026-10-01',
  };

  it('is optional and empty by default', () => {
    expect(createEmployeeRequestSchema.parse(employee).startingPay).toEqual([]);
  });

  it("must be in the country's currency, with each component once", () => {
    const result = createEmployeeRequestSchema.safeParse({
      ...employee,
      startingPay: [
        { componentId: basic, amount: '50000', currency: 'USD', frequency: 'monthly' },
        { componentId: basic, amount: '20000', currency: 'INR', frequency: 'monthly' },
      ],
    });

    expect(issuesOf(result)).toEqual([
      ['startingPay.0.currency', 'Pay for employees in India is in INR'],
      ['startingPay.1.componentId', 'Each component can appear only once in a pay change'],
    ]);
  });
});

describe('transferRequestSchema', () => {
  const move = {
    countryCode: 'US',
    region: 'Texas',
    effectiveFrom: '2026-09-24',
    items: [{ componentId: basic, amount: '4000', currency: 'USD', frequency: 'bi_weekly' }],
  };

  it('accepts a new country, region, date and pay in the new currency', () => {
    expect(transferRequestSchema.parse(move)).toEqual({ ...move, countryFields: {} });
  });

  it('checks the region and currency against the new country and needs some pay', () => {
    expect(
      issuesOf(
        transferRequestSchema.safeParse({
          ...move,
          region: 'Karnataka',
          items: [{ ...move.items[0], currency: 'INR' }],
        }),
      ),
    ).toEqual([
      ['region', 'Choose a state in United States'],
      ['items.0.currency', 'Pay for employees in United States is in USD'],
    ]);
    expect(issuesOf(transferRequestSchema.safeParse({ ...move, items: [] }))).toEqual([
      ['items', 'Add at least one pay component in the new country'],
    ]);
  });
});
