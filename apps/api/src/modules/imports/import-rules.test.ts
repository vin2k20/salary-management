import type { Employee } from '@salary/shared';
import { describe, expect, it } from 'vitest';
import type { ImportContext } from './import-rules.ts';
import { fileEmployeeCodes, planImport, summarize } from './import-rules.ts';
import type { RawCell, SheetRows } from './read-spreadsheet.ts';

const BASIC = '00000000-0000-4000-8000-00000000000a';
const HRA = '00000000-0000-4000-8000-00000000000b';
const OLD = '00000000-0000-4000-8000-00000000000c';
const BASE = '00000000-0000-4000-8000-00000000000d';

const aarav: Employee = {
  id: '10000000-0000-4000-8000-000000000001',
  employeeCode: 'IN-1',
  firstName: 'Aarav',
  lastName: 'Sharma',
  email: 'aarav.sharma@example.com',
  jobTitle: 'Software Engineer',
  jobLevel: 'L2',
  department: 'Engineering',
  countryCode: 'IN',
  region: 'Karnataka',
  employmentType: 'full_time',
  fte: 1,
  hireDate: '2025-01-01',
  status: 'active',
  inactiveOn: null,
  countryFields: { pfApplicable: true, esiApplicable: false },
};

const rohan: Employee = {
  ...aarav,
  id: '10000000-0000-4000-8000-000000000002',
  employeeCode: 'IN-2',
  firstName: 'Rohan',
  email: 'rohan@example.com',
  status: 'inactive',
  inactiveOn: '2026-06-30',
};

function context(overrides: Partial<ImportContext> = {}): ImportContext {
  return {
    scope: { kind: 'all' },
    today: '2026-09-24',
    employees: new Map([
      [aarav.employeeCode, aarav],
      [rohan.employeeCode, rohan],
    ]),
    codesOutsideScope: new Set(),
    components: [
      { id: BASIC, code: 'basic', name: 'Basic', countryCode: 'IN', isActive: true },
      { id: HRA, code: 'hra', name: 'HRA', countryCode: 'IN', isActive: true },
      { id: OLD, code: 'old', name: 'Old allowance', countryCode: 'IN', isActive: false },
      { id: BASE, code: 'base_salary', name: 'Base salary', countryCode: 'US', isActive: true },
    ],
    payToday: new Map([
      [
        aarav.id,
        new Map([
          [BASIC, { amountMinor: 5_000_000, currency: 'INR', frequency: 'monthly' }],
          [OLD, { amountMinor: 100_000, currency: 'INR', frequency: 'monthly' }],
        ]),
      ],
      [
        rohan.id,
        new Map([[BASIC, { amountMinor: 3_000_000, currency: 'INR', frequency: 'monthly' }]]),
      ],
    ]),
    payStates: new Map([
      [
        aarav.id,
        {
          countryCode: 'IN',
          hireDate: '2025-01-01',
          latestChangeDate: '2025-01-01',
          openItems: [
            { id: 'i1', componentId: BASIC, amountMinor: 5_000_000, frequency: 'monthly' },
            { id: 'i2', componentId: OLD, amountMinor: 100_000, frequency: 'monthly' },
          ],
        },
      ],
      [
        rohan.id,
        {
          countryCode: 'IN',
          hireDate: '2025-01-01',
          latestChangeDate: '2025-01-01',
          openItems: [
            { id: 'i3', componentId: BASIC, amountMinor: 3_000_000, frequency: 'monthly' },
          ],
        },
      ],
    ]),
    ...overrides,
  };
}

/** Aarav's row as export writes it, with some cells changed. */
function aaravRow(changes: Record<string, RawCell> = {}): Record<string, RawCell> {
  return {
    employeeCode: 'IN-1',
    firstName: 'Aarav',
    lastName: 'Sharma',
    email: 'aarav.sharma@example.com',
    jobTitle: 'Software Engineer',
    jobLevel: 'L2',
    department: 'Engineering',
    countryCode: 'IN',
    region: 'Karnataka',
    employmentType: 'full_time',
    fte: '1',
    hireDate: '2025-01-01',
    status: 'active',
    pfApplicable: 'yes',
    esiApplicable: 'no',
    ...changes,
  };
}

function newRow(changes: Record<string, RawCell> = {}): Record<string, RawCell> {
  return aaravRow({
    employeeCode: 'IN-9',
    firstName: 'Priya',
    email: 'priya@example.com',
    ...changes,
  });
}

function employeesSheet(...rows: Record<string, RawCell>[]): SheetRows {
  return {
    dataset: 'employees',
    sheet: 'Employees',
    rows: rows.map((cells, index) => ({ row: index + 2, cells: withoutNulls(cells) })),
  };
}

function paySheet(...rows: Record<string, RawCell>[]): SheetRows {
  return {
    dataset: 'pay',
    sheet: 'Pay components',
    rows: rows.map((cells, index) => ({ row: index + 2, cells: withoutNulls(cells) })),
  };
}

function withoutNulls(cells: Record<string, RawCell>) {
  return Object.fromEntries(Object.entries(cells).filter(([, value]) => value !== null));
}

function payRow(changes: Record<string, RawCell> = {}): Record<string, RawCell> {
  return {
    employeeCode: 'IN-1',
    componentCode: 'basic',
    amount: '50000.00',
    currency: 'INR',
    frequency: 'monthly',
    effectiveFrom: '2025-01-01',
    ...changes,
  };
}

const messages = (result: ReturnType<typeof planImport>) =>
  result.errors.map((error) => [error.sheet, error.row, error.column, error.message]);

describe('planImport: employees', () => {
  it('leaves rows that match the stored employee unchanged', () => {
    const result = planImport(
      [
        employeesSheet(
          aaravRow(),
          aaravRow({
            employeeCode: 'in-2',
            firstName: 'Rohan',
            email: 'rohan@example.com',
            status: 'inactive',
            inactiveOn: '2026-06-30',
          }),
        ),
      ],
      context(),
    );

    expect(result.errors).toEqual([]);
    expect(result.plan).toMatchObject({ creates: [], updates: [], unchangedEmployees: 2 });
  });

  it('treats a different spelling of a stored job title as unchanged', () => {
    const result = planImport(
      [employeesSheet(aaravRow({ jobTitle: ' software  ENGINEER ', fte: 1 }))],
      context(),
    );

    expect(result.plan.unchangedEmployees).toBe(1);
  });

  it('updates only the fields that changed', () => {
    const result = planImport(
      [
        employeesSheet(
          aaravRow({ department: 'Platform', jobLevel: null, fte: 0.5, esiApplicable: true }),
        ),
      ],
      context(),
    );

    expect(result.errors).toEqual([]);
    expect(result.plan.updates).toEqual([
      {
        row: 2,
        id: aarav.id,
        employeeCode: 'IN-1',
        update: {
          jobLevel: null,
          department: 'Platform',
          fte: 0.5,
          countryFields: { pfApplicable: true, esiApplicable: true },
        },
        fields: ['Job level', 'Department', 'FTE', 'ESI applicable (IN)'],
      },
    ]);
  });

  it('marks an employee inactive with a date', () => {
    const result = planImport(
      [
        employeesSheet(
          aaravRow({ status: 'inactive', inactiveOn: new Date(Date.UTC(2026, 8, 1)) }),
        ),
      ],
      context(),
    );

    expect(result.plan.updates[0]?.update).toEqual({
      status: 'inactive',
      inactiveOn: '2026-09-01',
    });
  });

  it('adds new employees as active, checked like the add form', () => {
    const result = planImport([employeesSheet(newRow())], context());

    expect(result.errors).toEqual([]);
    expect(result.plan.creates).toEqual([
      {
        row: 2,
        request: {
          employeeCode: 'IN-9',
          firstName: 'Priya',
          lastName: 'Sharma',
          email: 'priya@example.com',
          jobTitle: 'Software Engineer',
          jobLevel: 'L2',
          department: 'Engineering',
          countryCode: 'IN',
          region: 'Karnataka',
          employmentType: 'full_time',
          fte: 1,
          hireDate: '2025-01-01',
          countryFields: { pfApplicable: true, esiApplicable: false },
          startingPay: [],
        },
      },
    ]);
  });

  it('reports each problem by row and column', () => {
    const result = planImport(
      [
        employeesSheet(
          newRow({ firstName: null, hireDate: '01/02/2025', pfApplicable: 'maybe', fte: 'full' }),
          newRow({ employeeCode: 'IN-8', region: 'Texas', flsaStatus: 'exempt' }),
          newRow({ employeeCode: 'IN-7', status: 'inactive', inactiveOn: '2026-01-01' }),
        ),
      ],
      context(),
    );

    expect(messages(result)).toEqual([
      ['Employees', 2, 'First name', 'Enter a first name'],
      ['Employees', 2, 'FTE', 'Enter an FTE above 0 and up to 1'],
      ['Employees', 2, 'Hire date', 'Enter a valid date'],
      ['Employees', 2, 'PF applicable (IN)', 'Choose yes or no'],
      ['Employees', 3, 'Region', 'Choose a state or union territory in India'],
      ['Employees', 3, 'FLSA status (US)', 'Not used for employees in India'],
      [
        'Employees',
        4,
        'Status',
        'New employees are added as active; mark them inactive in the app afterwards',
      ],
    ]);
    expect(result.plan.creates).toEqual([]);
  });

  it('keeps the employee code and country fixed', () => {
    const result = planImport(
      [employeesSheet(aaravRow({ countryCode: 'US', region: 'Texas' }))],
      context(),
    );

    expect(messages(result)).toEqual([
      [
        'Employees',
        2,
        'Country',
        'The country cannot change in an import; use Move to another country in the app',
      ],
    ]);
  });

  it('rejects codes used twice in the file or by employees outside the scope', () => {
    const result = planImport(
      [employeesSheet(newRow(), newRow(), newRow({ employeeCode: 'US-1' }))],
      context({ codesOutsideScope: new Set(['US-1']) }),
    );

    expect(messages(result)).toEqual([
      ['Employees', 3, 'Employee code', 'IN-9 is already in row 2'],
      ['Employees', 4, 'Employee code', 'An employee with the code US-1 already exists'],
    ]);
  });

  it('only accepts rows for a country HR user own country', () => {
    const result = planImport(
      [
        employeesSheet(
          newRow({ countryCode: 'US', region: 'Texas', pfApplicable: null, esiApplicable: null }),
        ),
      ],
      context({ scope: { kind: 'country', countryCode: 'IN' } }),
    );

    expect(messages(result)).toEqual([
      ['Employees', 2, 'Country', 'You can only import employees in India'],
    ]);
  });
});

describe('planImport: pay', () => {
  it('leaves pay that matches today unchanged, whatever its date', () => {
    const result = planImport(
      [
        paySheet(
          payRow({ amount: 50000, effectiveFrom: '2024-01-01' }),
          payRow({ componentCode: 'old', amount: '1000' }),
        ),
      ],
      context(),
    );

    expect(result.errors).toEqual([]);
    expect(result.plan).toMatchObject({ payChanges: [], unchangedPay: 2 });
  });

  it('turns changed and new components into one pay change per employee', () => {
    const result = planImport(
      [
        paySheet(
          payRow({ amount: '55000', effectiveFrom: '2026-10-01' }),
          payRow({ componentCode: 'HRA', amount: 20000.5, effectiveFrom: '2026-10-01' }),
        ),
      ],
      context(),
    );

    expect(result.errors).toEqual([]);
    expect(result.plan.payChanges).toEqual([
      {
        rows: [2, 3],
        employeeCode: 'IN-1',
        employeeId: aarav.id,
        effectiveFrom: '2026-10-01',
        set: [
          { componentId: BASIC, amount: '55000.00', currency: 'INR', frequency: 'monthly' },
          { componentId: HRA, amount: '20000.50', currency: 'INR', frequency: 'monthly' },
        ],
        details: 'Basic, HRA from 2026-10-01',
      },
    ]);
  });

  it('gives starting pay to employees added in the same file', () => {
    const result = planImport(
      [employeesSheet(newRow()), paySheet(payRow({ employeeCode: 'IN-9' }))],
      context(),
    );

    expect(result.errors).toEqual([]);
    expect(result.plan.payChanges[0]).toMatchObject({
      employeeCode: 'IN-9',
      employeeId: null,
      effectiveFrom: '2025-01-01',
    });
  });

  it('checks each pay row', () => {
    const result = planImport(
      [
        paySheet(
          payRow({ employeeCode: 'XX-1' }),
          payRow({ componentCode: 'base_salary' }),
          payRow({ componentCode: 'hra', amount: '-5' }),
          payRow({ componentCode: 'hra', amount: 100.555, currency: 'USD', frequency: 'daily' }),
          payRow({ componentCode: 'old', amount: '2000', effectiveFrom: '2026-10-01' }),
          payRow({ employeeCode: 'IN-2', amount: '40000', effectiveFrom: '2026-10-01' }),
          payRow({ componentCode: 'hra', amount: '1', effectiveFrom: 'soon' }),
        ),
      ],
      context(),
    );

    expect(messages(result)).toEqual([
      ['Pay components', 2, 'Employee code', 'No employee with the code XX-1'],
      [
        'Pay components',
        3,
        'Component code',
        'No component with the code base_salary is used in India',
      ],
      ['Pay components', 4, 'Amount', 'Enter an amount above zero, such as 1250.50'],
      ['Pay components', 5, 'Amount', 'Use at most 2 decimal places'],
      ['Pay components', 5, 'Currency', 'Use INR, the currency of India'],
      [
        'Pay components',
        5,
        'Frequency',
        'Use weekly, bi_weekly, monthly, bi_monthly, quarterly, bi_quarterly, half_yearly or yearly',
      ],
      ['Pay components', 6, 'Component code', 'Old allowance is no longer in use'],
      ['Pay components', 7, 'Employee code', 'Mark the employee active before changing their pay'],
      ['Pay components', 8, 'Effective from', 'Enter a valid date'],
    ]);
  });

  it('needs one date for the changes of an employee, after their last pay change', () => {
    const differentDates = planImport(
      [
        paySheet(
          payRow({ amount: '55000', effectiveFrom: '2026-10-01' }),
          payRow({ componentCode: 'hra', amount: '100', effectiveFrom: '2026-11-01' }),
        ),
      ],
      context(),
    );
    expect(messages(differentDates)).toEqual([
      [
        'Pay components',
        3,
        'Effective from',
        'Use the same date as row 2 for every changed component of IN-1',
      ],
    ]);

    const tooEarly = planImport(
      [paySheet(payRow({ amount: '55000', effectiveFrom: '2025-01-01' }))],
      context(),
    );
    expect(messages(tooEarly)).toEqual([
      ['Pay components', 2, 'Effective from', "Choose a date after the employee's last pay change"],
    ]);
  });

  it('lists each component of an employee once', () => {
    const result = planImport([paySheet(payRow(), payRow({ amount: '1' }))], context());

    expect(messages(result)).toEqual([
      ['Pay components', 3, 'Component code', 'basic for IN-1 is already in row 2'],
    ]);
  });

  it('points pay rows of an employee row with problems to that row', () => {
    const result = planImport(
      [employeesSheet(newRow({ lastName: null })), paySheet(payRow({ employeeCode: 'IN-9' }))],
      context(),
    );

    expect(messages(result)).toEqual([
      ['Employees', 2, 'Last name', 'Enter a last name'],
      ['Pay components', 2, 'Employee code', 'Fix row 2 of the Employees sheet first'],
    ]);
  });
});

describe('fileEmployeeCodes', () => {
  it('lists each employee code in the file once, as stored', () => {
    const codes = fileEmployeeCodes([
      employeesSheet(newRow({ employeeCode: ' in-9 ' }), newRow({ employeeCode: null })),
      paySheet(payRow(), payRow({ employeeCode: 'IN-9' }), payRow({ employeeCode: 'in-1' })),
    ]);

    expect(codes).toEqual(['IN-9', 'IN-1']);
  });
});

describe('summarize', () => {
  it('counts every change and lists the first ones', () => {
    const result = planImport(
      [
        employeesSheet(newRow(), aaravRow({ department: 'Platform' })),
        paySheet(payRow({ amount: '55000', effectiveFrom: '2026-10-01' })),
      ],
      context(),
    );

    expect(summarize(result)).toEqual({
      valid: true,
      employees: { added: 1, updated: 1, unchanged: 0 },
      pay: { changed: 1, unchanged: 0 },
      changes: [
        {
          sheet: 'Employees',
          row: 2,
          employeeCode: 'IN-9',
          action: 'add',
          details: 'Priya Sharma, Software Engineer',
        },
        {
          sheet: 'Employees',
          row: 3,
          employeeCode: 'IN-1',
          action: 'update',
          details: 'Department',
        },
        {
          sheet: 'Pay components',
          row: 2,
          employeeCode: 'IN-1',
          action: 'pay',
          details: 'Basic from 2026-10-01',
        },
      ],
      errors: [],
      errorCount: 0,
    });
  });

  it('marks a file with problems as not valid', () => {
    const result = planImport([employeesSheet(newRow({ email: 'nope' }))], context());

    expect(summarize(result)).toMatchObject({
      valid: false,
      errorCount: 1,
      errors: [{ row: 2, column: 'Email', message: 'Enter a valid email address' }],
    });
  });
});
