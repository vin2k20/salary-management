import { z } from 'zod';
import type { CurrencyCode } from './money.ts';

/** The four countries in scope and their local currencies. */
export const COUNTRIES = {
  US: { name: 'United States', currencyCode: 'USD' },
  CA: { name: 'Canada', currencyCode: 'CAD' },
  AU: { name: 'Australia', currencyCode: 'AUD' },
  IN: { name: 'India', currencyCode: 'INR' },
} as const satisfies Record<string, { name: string; currencyCode: CurrencyCode }>;

export type CountryCode = keyof typeof COUNTRIES;

export const COUNTRY_CODES = Object.keys(COUNTRIES) as CountryCode[];

export const countryCodeSchema = z.enum(COUNTRY_CODES as [CountryCode, ...CountryCode[]]);
