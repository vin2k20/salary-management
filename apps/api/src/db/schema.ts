import {
  CHANGE_LOG_ACTIONS,
  CHANGE_LOG_ENTITY_TYPES,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  PAY_CHANGE_REASONS,
  PAY_COMPONENT_CATEGORIES,
  type FieldChanges,
} from '@salary/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** SQL list of allowed values for a CHECK constraint, for example ('a', 'b'). */
function allowedValues(values: readonly string[]) {
  return sql.raw(`(${values.map((value) => `'${value}'`).join(', ')})`);
}

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

// Tables follow the data model in docs/high-level-design.md, section 4.

export const currencies = pgTable(
  'currencies',
  {
    code: char('code', { length: 3 }).primaryKey(),
    name: text('name').notNull(),
    minorDigits: smallint('minor_digits').notNull(),
  },
  (table) => [check('currencies_minor_digits_check', sql`${table.minorDigits} between 0 and 4`)],
);

export const countries = pgTable('countries', {
  code: char('code', { length: 2 }).primaryKey(),
  name: text('name').notNull(),
  currencyCode: char('currency_code', { length: 3 })
    .notNull()
    .references(() => currencies.code),
});

export const payFrequencies = pgTable(
  'pay_frequencies',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    periodsPerYear: smallint('periods_per_year').notNull(),
  },
  (table) => [check('pay_frequencies_periods_per_year_check', sql`${table.periodsPerYear} > 0`)],
);

/** Catalogue of pay components. A component without a country applies to all countries. */
export const payComponents = pgTable(
  'pay_components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    category: text('category', { enum: PAY_COMPONENT_CATEGORIES }).notNull(),
    countryCode: char('country_code', { length: 2 }).references(() => countries.code),
    defaultFrequency: text('default_frequency')
      .notNull()
      .references(() => payFrequencies.code),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    unique('pay_components_code_country_unique')
      .on(table.code, table.countryCode)
      .nullsNotDistinct(),
    check(
      'pay_components_category_check',
      sql`${table.category} in ${allowedValues(PAY_COMPONENT_CATEGORIES)}`,
    ),
  ],
);

/**
 * Employees. Country-specific fields live in country_fields and are validated by a Zod schema per
 * country. No government IDs, bank details, date of birth or gender are stored.
 */
export const employees = pgTable(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeCode: text('employee_code').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    jobTitle: text('job_title').notNull(),
    jobLevel: text('job_level'),
    department: text('department').notNull(),
    countryCode: char('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code),
    region: text('region').notNull(),
    employmentType: text('employment_type', { enum: EMPLOYMENT_TYPES }).notNull(),
    fte: numeric('fte', { precision: 4, scale: 3, mode: 'number' }).notNull().default(1),
    hireDate: date('hire_date', { mode: 'string' }).notNull(),
    status: text('status', { enum: EMPLOYEE_STATUSES }).notNull().default('active'),
    inactiveOn: date('inactive_on', { mode: 'string' }),
    countryFields: jsonb('country_fields').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    unique('employees_employee_code_unique').on(table.employeeCode),
    check(
      'employees_employment_type_check',
      sql`${table.employmentType} in ${allowedValues(EMPLOYMENT_TYPES)}`,
    ),
    check('employees_status_check', sql`${table.status} in ${allowedValues(EMPLOYEE_STATUSES)}`),
    check(
      'employees_inactive_on_check',
      sql`(${table.status} = 'inactive') = (${table.inactiveOn} is not null)`,
    ),
    check('employees_fte_check', sql`${table.fte} > 0 and ${table.fte} <= 1`),
    index('employees_country_code_idx').on(table.countryCode),
    index('employees_department_idx').on(table.department),
    index('employees_job_title_idx').on(table.jobTitle),
    index('employees_employment_type_idx').on(table.employmentType),
    index('employees_status_idx').on(table.status),
    // Partial name search; queries must use the same expression to use the index.
    index('employees_full_name_trgm_idx').using(
      'gin',
      sql`(${table.firstName} || ' ' || ${table.lastName}) gin_trgm_ops`,
    ),
  ],
);

/** A dated change to one employee's pay, grouping the pay items it ends and starts. */
export const payChanges = pgTable(
  'pay_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    reason: text('reason', { enum: PAY_CHANGE_REASONS }).notNull(),
    note: text('note'),
    // References users from step 07.
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('pay_changes_reason_check', sql`${table.reason} in ${allowedValues(PAY_CHANGE_REASONS)}`),
    index('pay_changes_employee_id_effective_from_idx').on(table.employeeId, table.effectiveFrom),
  ],
);

/**
 * One pay component for one employee: an amount per period in the employee's local currency.
 * It applies from effective_from up to, but not including, effective_to; an open item has no
 * effective_to. Each employee has at most one open item per component.
 */
export const payItems = pgTable(
  'pay_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    payChangeId: uuid('pay_change_id')
      .notNull()
      .references(() => payChanges.id),
    componentId: uuid('component_id')
      .notNull()
      .references(() => payComponents.id),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currencyCode: char('currency_code', { length: 3 })
      .notNull()
      .references(() => currencies.code),
    frequencyCode: text('frequency_code')
      .notNull()
      .references(() => payFrequencies.code),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    effectiveTo: date('effective_to', { mode: 'string' }),
  },
  (table) => [
    check('pay_items_amount_minor_check', sql`${table.amountMinor} >= 0`),
    check(
      'pay_items_effective_dates_check',
      sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
    uniqueIndex('pay_items_one_open_item_idx')
      .on(table.employeeId, table.componentId)
      .where(sql`${table.effectiveTo} is null`),
    index('pay_items_employee_id_effective_from_idx').on(table.employeeId, table.effectiveFrom),
  ],
);

/**
 * Exchange rates per currency and date, as units of the currency per US dollar. History is kept
 * so earlier figures can be reproduced. The rate is an exact decimal, read as a string.
 */
export const fxRates = pgTable(
  'fx_rates',
  {
    currencyCode: char('currency_code', { length: 3 })
      .notNull()
      .references(() => currencies.code),
    rateDate: date('rate_date', { mode: 'string' }).notNull(),
    unitsPerUsd: numeric('units_per_usd', { precision: 18, scale: 8 }).notNull(),
    source: text('source').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.currencyCode, table.rateDate] }),
    check('fx_rates_units_per_usd_check', sql`${table.unitsPerUsd} > 0`),
  ],
);

/**
 * Every change to employees, pay, pay components and users, written in the same transaction as
 * the change and never edited. The country allows scope filtering for country HR users.
 */
export const changeLog = pgTable(
  'change_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type', { enum: CHANGE_LOG_ENTITY_TYPES }).notNull(),
    entityId: uuid('entity_id').notNull(),
    action: text('action', { enum: CHANGE_LOG_ACTIONS }).notNull(),
    changes: jsonb('changes').$type<FieldChanges>().notNull(),
    countryCode: char('country_code', { length: 2 }).references(() => countries.code),
    // References users from step 07.
    changedBy: uuid('changed_by'),
    // Set from the application clock, so tests control it.
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    check(
      'change_log_entity_type_check',
      sql`${table.entityType} in ${allowedValues(CHANGE_LOG_ENTITY_TYPES)}`,
    ),
    check('change_log_action_check', sql`${table.action} in ${allowedValues(CHANGE_LOG_ACTIONS)}`),
    index('change_log_entity_idx').on(table.entityType, table.entityId, table.changedAt),
  ],
);
