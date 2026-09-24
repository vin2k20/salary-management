import { z } from 'zod';
import { CURRENCY_CODES, type CurrencyCode } from './money.ts';

/** Rates are units of a currency per US dollar, as exact decimal strings such as "95.96". */
export const unitsPerUsdSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Not a decimal rate');

const currencyCodeSchema = z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]]);

/** Rates older than this many days get a notice on screen. */
export const STALE_RATES_AFTER_DAYS = 3;

/** The latest stored rate for each currency and the date they apply to. */
export const fxRatesResponseSchema = z.object({
  /** Oldest of the latest dates, so every rate shown is at least this recent; null if none. */
  rateDate: z.iso.date().nullable(),
  rates: z.partialRecord(currencyCodeSchema, unitsPerUsdSchema),
  /** True when the rates are more than STALE_RATES_AFTER_DAYS days old. */
  stale: z.boolean(),
});

export type FxRatesResponse = z.infer<typeof fxRatesResponseSchema>;

export const fxRefreshResponseSchema = fxRatesResponseSchema.extend({
  /** How many new rates were stored; zero when the provider had nothing newer. */
  stored: z.number().int().nonnegative(),
});

export type FxRefreshResponse = z.infer<typeof fxRefreshResponseSchema>;

/** How amounts are shown: in each employee's local currency, or converted to US dollars. */
export const DISPLAY_CURRENCIES = ['local', 'USD'] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const displayCurrencySchema = z.enum(DISPLAY_CURRENCIES);
