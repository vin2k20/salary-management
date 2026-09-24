import { PAY_COMPONENT_CATEGORIES } from '@salary/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
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
