import { sql } from 'drizzle-orm';
import { char, check, pgTable, smallint, text } from 'drizzle-orm/pg-core';

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
