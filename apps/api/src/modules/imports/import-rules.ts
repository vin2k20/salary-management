import {
  COUNTRIES,
  COUNTRY_FIELD_KEYS,
  EMPLOYEE_COLUMNS,
  IMPORT_LIMITS,
  PAY_COLUMNS,
  PAY_FREQUENCY_CODES,
  SPREADSHEETS,
  createEmployeeRequestSchema,
  fromMinorUnits,
  minorDigits,
  positiveMinorUnits,
  updateEmployeeRequestSchema,
  type CountryCode,
  type CreateEmployeeRequest,
  type CurrencyCode,
  type Employee,
  type EmployeeColumnKey,
  type ImportChange,
  type ImportError,
  type ImportSummary,
  type PayColumnKey,
  type PayFrequencyCode,
  type PayLine,
  type UpdateEmployeeRequest,
} from '@salary/shared';
import { z } from 'zod';
import type { Scope } from '../auth/scope.ts';
import { planPayChange, type ComponentInfo, type PayState } from '../compensation/pay-rules.ts';
import { applyUpdate } from '../employees/employee-record.service.ts';
import type { RawCell, SheetRow, SheetRows } from './read-spreadsheet.ts';

/**
 * Import rules as plain functions (D20): every row of a file is checked against what is stored,
 * with the same schemas and pay rules as the forms, and turned into a plan of changes. The
 * service loads the context and writes the plan in one transaction.
 */

export interface TodayItem {
  amountMinor: number;
  currency: string;
  frequency: string;
}

export interface ImportContext {
  scope: Scope;
  today: string;
  /** Employees in the caller's scope, by employee code. */
  employees: ReadonlyMap<string, Employee>;
  /** Employee codes used outside the caller's scope, which new employees cannot take. */
  codesOutsideScope: ReadonlySet<string>;
  /** Components the caller's scope can use. */
  components: readonly (ComponentInfo & { code: string })[];
  /** Pay in force today, by employee ID and component ID. */
  payToday: ReadonlyMap<string, ReadonlyMap<string, TodayItem>>;
  /** What the pay change rules need, by employee ID. */
  payStates: ReadonlyMap<string, PayState>;
}

export interface EmployeeCreate {
  row: number;
  request: CreateEmployeeRequest;
}

export interface EmployeeUpdate {
  row: number;
  id: string;
  employeeCode: string;
  update: UpdateEmployeeRequest;
  /** Headers of the changed columns. */
  fields: string[];
}

export interface PayUpdate {
  rows: number[];
  employeeCode: string;
  /** Null for an employee added by the same file. */
  employeeId: string | null;
  effectiveFrom: string;
  set: PayLine[];
  details: string;
}

export interface ImportPlan {
  creates: EmployeeCreate[];
  updates: EmployeeUpdate[];
  payChanges: PayUpdate[];
  unchangedEmployees: number;
  unchangedPay: number;
}

export interface ImportResult {
  plan: ImportPlan;
  errors: ImportError[];
}

const EMPLOYEES_SHEET = SPREADSHEETS.employees.sheetName;
const PAY_SHEET = SPREADSHEETS.pay.sheetName;
const EMPLOYEE_HEADERS = new Map<string, string>(EMPLOYEE_COLUMNS.map((c) => [c.key, c.header]));
const PAY_HEADERS = new Map<string, string>(PAY_COLUMNS.map((c) => [c.key, c.header]));
const isoDate = z.iso.date();

function header(key: EmployeeColumnKey): string {
  return EMPLOYEE_HEADERS.get(key) ?? key;
}

function payHeader(key: PayColumnKey): string {
  return PAY_HEADERS.get(key) ?? key;
}

// Cells as values the shared schemas read. A value the schema cannot use is passed on as text,
// so the schema's own message explains the problem.

function textOf(cell: RawCell | undefined): string | undefined {
  if (cell === undefined || cell === null) return undefined;
  // Excel date cells are midnight UTC, so the UTC date is the date shown.
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  if (typeof cell === 'boolean') return cell ? 'yes' : 'no';
  const text = String(cell).trim();
  return text === '' ? undefined : text;
}

function numberOf(cell: RawCell | undefined): number | string | undefined {
  if (typeof cell === 'number') return cell;
  const text = textOf(cell);
  return text !== undefined && /^\d+(\.\d+)?$/.test(text) ? Number(text) : text;
}

function yesNoOf(cell: RawCell | undefined): boolean | string | undefined {
  if (typeof cell === 'boolean') return cell;
  const text = textOf(cell)?.toLowerCase();
  if (text === 'yes' || text === 'true') return true;
  if (text === 'no' || text === 'false') return false;
  return text;
}

function withoutUndefined(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

/** A row of the Employees sheet as the add employee request. */
function employeeInput(cells: SheetRow['cells']) {
  return {
    employeeCode: textOf(cells.employeeCode)?.toUpperCase(),
    firstName: textOf(cells.firstName),
    lastName: textOf(cells.lastName),
    email: textOf(cells.email),
    jobTitle: textOf(cells.jobTitle),
    jobLevel: textOf(cells.jobLevel) ?? null,
    department: textOf(cells.department),
    countryCode: textOf(cells.countryCode)?.toUpperCase(),
    region: textOf(cells.region),
    employmentType: textOf(cells.employmentType)?.toLowerCase(),
    fte: numberOf(cells.fte),
    hireDate: textOf(cells.hireDate),
    countryFields: withoutUndefined({
      flsaStatus: textOf(cells.flsaStatus)?.toLowerCase(),
      award: textOf(cells.award),
      pfApplicable: yesNoOf(cells.pfApplicable),
      esiApplicable: yesNoOf(cells.esiApplicable),
    }),
    startingPay: [],
  };
}

/** The column of a schema issue: country fields sit one level down. */
function issueColumn(path: readonly PropertyKey[]): string | null {
  const key = path[0] === 'countryFields' ? path[1] : path[0];
  return typeof key === 'string' ? (EMPLOYEE_HEADERS.get(key) ?? null) : null;
}

const COMPARED_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'jobTitle',
  'jobLevel',
  'department',
  'region',
  'employmentType',
  'fte',
  'hireDate',
  'status',
  'inactiveOn',
] as const satisfies readonly (keyof Employee & EmployeeColumnKey)[];

/** Job titles and departments keep the stored spelling, so case alone is not a change. */
function sameValue(field: (typeof COMPARED_FIELDS)[number], a: unknown, b: unknown): boolean {
  if ((field === 'jobTitle' || field === 'department') && typeof a === 'string') {
    return typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

function planEmployees(sheet: SheetRows, context: ImportContext, errors: ImportError[]) {
  const creates: EmployeeCreate[] = [];
  const updates: EmployeeUpdate[] = [];
  let unchanged = 0;
  const seen = new Map<string, number>();
  /** New employees whose row has problems, by code, with the row. */
  const invalidNew = new Map<string, number>();

  for (const { row, cells } of sheet.rows) {
    const rowErrors: ImportError[] = [];
    const fail = (column: string | null, message: string) => {
      rowErrors.push({ sheet: EMPLOYEES_SHEET, row, column, message });
    };
    // Problems are added through fail(), so count them with a call rather than a narrowed length.
    const problems = () => rowErrors.length;
    const input = employeeInput(cells);
    const code = input.employeeCode;
    const current = code === undefined ? undefined : context.employees.get(code);

    if (code !== undefined) {
      const earlier = seen.get(code);
      if (earlier === undefined) seen.set(code, row);
      else fail(header('employeeCode'), `${code} is already in row ${String(earlier)}`);
    }
    if (!current && code !== undefined && context.codesOutsideScope.has(code)) {
      fail(header('employeeCode'), `An employee with the code ${code} already exists`);
    }
    if (current && input.countryCode !== current.countryCode) {
      fail(
        header('countryCode'),
        'The country cannot change in an import; use Move to another country in the app',
      );
    } else if (
      context.scope.kind === 'country' &&
      input.countryCode !== undefined &&
      input.countryCode !== context.scope.countryCode
    ) {
      fail(
        header('countryCode'),
        `You can only import employees in ${COUNTRIES[context.scope.countryCode].name}`,
      );
    }

    const status = textOf(cells.status)?.toLowerCase() ?? 'active';
    const inactiveOn = textOf(cells.inactiveOn) ?? null;
    if (rowErrors.length === 0) {
      const parsed = createEmployeeRequestSchema.safeParse(input);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) fail(issueColumn(issue.path), issue.message);
      }
      if (status !== 'active' && status !== 'inactive') {
        fail(header('status'), 'Use active or inactive');
      }
      if (inactiveOn !== null && !isoDate.safeParse(inactiveOn).success) {
        fail(header('inactiveOn'), 'Enter a valid date');
      }
      if (!current && (status === 'inactive' || inactiveOn !== null)) {
        fail(
          header('status'),
          'New employees are added as active; mark them inactive in the app afterwards',
        );
      }

      if (parsed.success && problems() === 0) {
        if (!current) {
          creates.push({ row, request: parsed.data });
        } else {
          const {
            employeeCode: _code,
            countryCode: _country,
            startingPay: _pay,
            ...details
          } = parsed.data;
          const candidate = updateEmployeeRequestSchema.parse({
            ...details,
            status,
            inactiveOn,
          });
          const { next, issues } = applyUpdate(current, candidate, context.today);
          for (const issue of issues) fail(issueColumn(issue.path), issue.message);
          if (issues.length === 0) {
            const change: Record<string, unknown> = {};
            const fields: string[] = [];
            for (const field of COMPARED_FIELDS) {
              if (!sameValue(field, next[field], current[field])) {
                change[field] = next[field];
                fields.push(header(field));
              }
            }
            for (const key of COUNTRY_FIELD_KEYS[current.countryCode]) {
              if (next.countryFields[key] !== current.countryFields[key]) {
                change.countryFields = next.countryFields;
                fields.push(header(key));
              }
            }
            if (fields.length === 0) {
              unchanged += 1;
            } else {
              updates.push({
                row,
                id: current.id,
                employeeCode: current.employeeCode,
                update: updateEmployeeRequestSchema.parse(change),
                fields: EMPLOYEE_COLUMNS.map((column) => column.header).filter((name) =>
                  fields.includes(name),
                ),
              });
            }
          }
        }
      }
    }
    if (rowErrors.length > 0 && !current && code !== undefined && !invalidNew.has(code)) {
      invalidNew.set(code, row);
    }
    errors.push(...rowErrors);
  }
  return { creates, updates, unchanged, invalidNew };
}

/** An amount cell as a decimal string in the currency, or the problem with it. */
function amountOf(
  cell: RawCell | undefined,
  currency: CurrencyCode,
): { amount: string; minor: number } | { problem: string } {
  const digits = minorDigits(currency);
  const tooPrecise = { problem: `Use at most ${String(digits)} decimal places` };
  let text: string | undefined;
  if (typeof cell === 'number') {
    // Excel amounts are numbers; they must read back to whole minor units exactly.
    if (!Number.isFinite(cell)) return { problem: 'Enter an amount above zero, such as 1250.50' };
    text = cell.toFixed(digits);
    if (Number(text) !== cell) return tooPrecise;
  } else {
    text = textOf(cell)?.replaceAll(',', '');
    const fraction = text !== undefined ? /\.(\d+)$/.exec(text)?.[1] : undefined;
    if (fraction !== undefined && fraction.length > digits) return tooPrecise;
  }
  const minor = text === undefined ? null : positiveMinorUnits(text, currency);
  if (minor === null) return { problem: 'Enter an amount above zero, such as 1250.50' };
  return { amount: fromMinorUnits(minor, currency), minor };
}

interface PayEmployee {
  code: string;
  id: string | null;
  countryCode: CountryCode;
  hireDate: string;
  active: boolean;
}

interface ChangedPayRow {
  row: number;
  componentId: string;
  componentName: string;
  line: PayLine;
  effectiveFrom: string;
}

function isFrequency(value: string | undefined): value is PayFrequencyCode {
  return PAY_FREQUENCY_CODES.some((code) => code === value);
}

const FREQUENCY_LIST = `${PAY_FREQUENCY_CODES.slice(0, -1).join(', ')} or ${PAY_FREQUENCY_CODES.at(-1) ?? ''}`;

function planPay(
  sheet: SheetRows,
  context: ImportContext,
  created: ReadonlyMap<string, EmployeeCreate>,
  invalidNew: ReadonlyMap<string, number>,
  errors: ImportError[],
) {
  let unchanged = 0;
  const seen = new Map<string, number>();
  const changed = new Map<string, { employee: PayEmployee; rows: ChangedPayRow[] }>();

  for (const { row, cells } of sheet.rows) {
    const rowErrors: ImportError[] = [];
    const fail = (key: PayColumnKey, message: string) => {
      rowErrors.push({ sheet: PAY_SHEET, row, column: payHeader(key), message });
    };
    const code = textOf(cells.employeeCode)?.toUpperCase();
    const current = code === undefined ? undefined : context.employees.get(code);
    const create = code === undefined ? undefined : created.get(code);
    let employee: PayEmployee | undefined;
    if (current) {
      employee = {
        code: current.employeeCode,
        id: current.id,
        countryCode: current.countryCode,
        hireDate: current.hireDate,
        active: current.status === 'active',
      };
    } else if (create) {
      employee = {
        code: create.request.employeeCode,
        id: null,
        countryCode: create.request.countryCode,
        hireDate: create.request.hireDate,
        active: true,
      };
    } else if (code === undefined) {
      fail('employeeCode', 'Enter an employee code');
    } else if (invalidNew.has(code)) {
      fail(
        'employeeCode',
        `Fix row ${String(invalidNew.get(code) ?? '')} of the ${EMPLOYEES_SHEET} sheet first`,
      );
    } else {
      fail('employeeCode', `No employee with the code ${code}`);
    }
    if (!employee) {
      errors.push(...rowErrors);
      continue;
    }

    const country = COUNTRIES[employee.countryCode];
    const componentCode = textOf(cells.componentCode)?.toLowerCase();
    const candidates = context.components.filter(
      (item) =>
        item.code === componentCode &&
        (item.countryCode === employee.countryCode || item.countryCode === null),
    );
    const component = candidates.find((item) => item.countryCode !== null) ?? candidates.at(0);
    if (!component) {
      fail(
        'componentCode',
        componentCode === undefined
          ? 'Enter a component code'
          : `No component with the code ${componentCode} is used in ${country.name}`,
      );
    }
    const amount = amountOf(cells.amount, country.currencyCode);
    if ('problem' in amount) fail('amount', amount.problem);
    if (textOf(cells.currency)?.toUpperCase() !== country.currencyCode) {
      fail('currency', `Use ${country.currencyCode}, the currency of ${country.name}`);
    }
    const frequency = textOf(cells.frequency)?.toLowerCase();
    if (!isFrequency(frequency)) fail('frequency', `Use ${FREQUENCY_LIST}`);
    const effectiveFrom = textOf(cells.effectiveFrom);
    if (effectiveFrom === undefined || !isoDate.safeParse(effectiveFrom).success) {
      fail('effectiveFrom', 'Enter a valid date');
    }
    if (
      rowErrors.length > 0 ||
      !component ||
      'problem' in amount ||
      !isFrequency(frequency) ||
      effectiveFrom === undefined
    ) {
      errors.push(...rowErrors);
      continue;
    }

    const key = `${employee.code} ${component.id}`;
    const earlier = seen.get(key);
    if (earlier !== undefined) {
      fail(
        'componentCode',
        `${component.code} for ${employee.code} is already in row ${String(earlier)}`,
      );
      errors.push(...rowErrors);
      continue;
    }
    seen.set(key, row);

    const today = employee.id === null ? undefined : context.payToday.get(employee.id);
    const item = today?.get(component.id);
    if (
      item?.amountMinor === amount.minor &&
      item.frequency === frequency &&
      item.currency === country.currencyCode
    ) {
      unchanged += 1;
      continue;
    }
    if (!component.isActive) {
      fail('componentCode', `${component.name} is no longer in use`);
    } else if (!employee.active) {
      fail('employeeCode', 'Mark the employee active before changing their pay');
    }
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }
    const group = changed.get(employee.code) ?? { employee, rows: [] };
    group.rows.push({
      row,
      componentId: component.id,
      componentName: component.name,
      line: {
        componentId: component.id,
        amount: amount.amount,
        currency: country.currencyCode,
        frequency,
      },
      effectiveFrom,
    });
    changed.set(employee.code, group);
  }

  const components = new Map(context.components.map((item) => [item.id, item]));
  const payChanges: PayUpdate[] = [];
  for (const { employee, rows } of changed.values()) {
    const [first] = rows;
    if (!first) continue;
    const mixed = rows.filter((row) => row.effectiveFrom !== first.effectiveFrom);
    for (const row of mixed) {
      errors.push({
        sheet: PAY_SHEET,
        row: row.row,
        column: payHeader('effectiveFrom'),
        message: `Use the same date as row ${String(first.row)} for every changed component of ${employee.code}`,
      });
    }
    if (mixed.length > 0) continue;

    const state: PayState = (employee.id === null
      ? undefined
      : context.payStates.get(employee.id)) ?? {
      countryCode: employee.countryCode,
      hireDate: employee.hireDate,
      latestChangeDate: null,
      openItems: [],
    };
    const set = rows.map((row) => row.line);
    const result = planPayChange(
      state,
      { effectiveFrom: first.effectiveFrom, set, end: [] },
      components,
    );
    if (!result.ok) {
      for (const issue of result.issues) {
        const [, index, field] = issue.field.split('.');
        const target = rows[Number(index)] ?? first;
        let column: PayColumnKey = 'effectiveFrom';
        if (field === 'componentId') column = 'componentCode';
        if (field === 'amount' || field === 'currency') column = field;
        errors.push({
          sheet: PAY_SHEET,
          row: target.row,
          column: payHeader(column),
          message: issue.message,
        });
      }
      continue;
    }
    payChanges.push({
      rows: rows.map((row) => row.row),
      employeeCode: employee.code,
      employeeId: employee.id,
      effectiveFrom: first.effectiveFrom,
      set,
      details: `${rows.map((row) => row.componentName).join(', ')} from ${first.effectiveFrom}`,
    });
  }
  return { payChanges, unchanged };
}

const SHEET_ORDER: string[] = [EMPLOYEES_SHEET, PAY_SHEET];
const COLUMN_ORDER = new Map<string, number>([
  ...EMPLOYEE_COLUMNS.map(
    (column, index) => [`${EMPLOYEES_SHEET} ${column.header}`, index] as const,
  ),
  ...PAY_COLUMNS.map((column, index) => [`${PAY_SHEET} ${column.header}`, index] as const),
]);

function columnPosition(error: ImportError): number {
  return error.column === null ? -1 : (COLUMN_ORDER.get(`${error.sheet} ${error.column}`) ?? 0);
}

/** Problems in the order a person reads the file: sheet, row, then column. */
function byPosition(a: ImportError, b: ImportError): number {
  return (
    SHEET_ORDER.indexOf(a.sheet) - SHEET_ORDER.indexOf(b.sheet) ||
    (a.row ?? 0) - (b.row ?? 0) ||
    columnPosition(a) - columnPosition(b)
  );
}

/** Checks every row of the sheets read from a file and plans the changes they make. */
export function planImport(sheets: readonly SheetRows[], context: ImportContext): ImportResult {
  const errors: ImportError[] = [];
  const employeeSheet = sheets.find((sheet) => sheet.dataset === 'employees');
  const paySheet = sheets.find((sheet) => sheet.dataset === 'pay');
  const employees = employeeSheet
    ? planEmployees(employeeSheet, context, errors)
    : { creates: [], updates: [], unchanged: 0, invalidNew: new Map<string, number>() };
  const created = new Map(employees.creates.map((create) => [create.request.employeeCode, create]));
  const pay = paySheet
    ? planPay(paySheet, context, created, employees.invalidNew, errors)
    : { payChanges: [], unchanged: 0 };
  return {
    plan: {
      creates: employees.creates,
      updates: employees.updates,
      payChanges: pay.payChanges,
      unchangedEmployees: employees.unchanged,
      unchangedPay: pay.unchanged,
    },
    errors: errors.sort(byPosition),
  };
}

/** What the file does, for the preview and the result: counts, then the first changes. */
export function summarize(
  { plan, errors }: ImportResult,
  maxListed: number = IMPORT_LIMITS.maxListed,
): ImportSummary {
  const changes: ImportChange[] = [
    ...plan.creates.map(({ row, request }) => ({
      sheet: EMPLOYEES_SHEET,
      row,
      employeeCode: request.employeeCode,
      action: 'add' as const,
      details: `${request.firstName} ${request.lastName}, ${request.jobTitle}`,
    })),
    ...plan.updates.map(({ row, employeeCode, fields }) => ({
      sheet: EMPLOYEES_SHEET,
      row,
      employeeCode,
      action: 'update' as const,
      details: fields.join(', '),
    })),
    ...plan.payChanges.map(({ rows, employeeCode, details }) => ({
      sheet: PAY_SHEET,
      row: rows[0] ?? 1,
      employeeCode,
      action: 'pay' as const,
      details,
    })),
  ];
  return {
    valid: errors.length === 0,
    employees: {
      added: plan.creates.length,
      updated: plan.updates.length,
      unchanged: plan.unchangedEmployees,
    },
    pay: { changed: plan.payChanges.length, unchanged: plan.unchangedPay },
    changes: changes.slice(0, maxListed),
    errors: errors.slice(0, maxListed),
    errorCount: errors.length,
  };
}
