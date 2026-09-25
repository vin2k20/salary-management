import {
  COUNTRIES,
  convertMinor,
  divideHalfEven,
  monthlyEquivalentMinor,
  type CountryCode,
  type CurrencyCode,
  type DisplayCurrency,
  type FxRatesResponse,
  type InsightsQuery,
  type CostByDepartmentResponse,
  type InsightsSummary,
  type Money,
  type PayByJobTitleResponse,
  type PayRangeByCountryResponse,
} from '@salary/shared';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError, RequestValidationError } from '../../http/errors.ts';
import type { Scope } from '../auth/scope.ts';
import { latestRates } from '../fx-rates/fx-rates.service.ts';
import {
  costByCountry,
  costByDepartment,
  payByJobTitle,
  payRangeByCountry,
  type Filters,
} from './insights.repository.ts';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function today(clock: Clock): string {
  return clock.now().toISOString().slice(0, 10);
}

/** An exact integer from SQL (as text), divided once with halves to even, as minor units. */
export function minorFrom(value: string, divisor = 1n): number {
  const result = divideHalfEven(BigInt(value), divisor);
  if (result > MAX_SAFE || result < -MAX_SAFE) throw new Error('Amount is too large');
  return Number(result);
}

export function filtersFor(scope: Scope, query: InsightsQuery): Filters {
  return {
    scope,
    country: query.country,
    measure: query.measure,
    includeInactive: query.includeInactive,
  };
}

/** The one country a view shows: the one asked for, or a country HR user's own; else null. */
export function viewCountry(scope: Scope, country: CountryCode | undefined): CountryCode | null {
  return country ?? (scope.kind === 'country' ? scope.countryCode : null);
}

/** The latest rates, loaded only when an amount will be converted. */
export async function ratesIf(
  needed: boolean,
  db: Database,
  clock: Clock,
): Promise<FxRatesResponse | null> {
  return needed ? latestRates(db, clock) : null;
}

/**
 * An amount in its local currency, or converted to US dollars with the same exact helper as the
 * directory. Converting without a rate would give a wrong figure, so the request fails instead.
 */
export function inDisplay(
  amountMinor: number,
  currency: CurrencyCode,
  display: DisplayCurrency,
  rates: FxRatesResponse | null,
): Money {
  if (display === 'local' || currency === 'USD') return { amountMinor, currency };
  if (rates?.rates[currency] === undefined || rates.rates.USD === undefined) {
    throw new HttpError(503, 'Exchange rates are not available yet. Try again later.');
  }
  return { amountMinor: convertMinor(amountMinor, currency, 'USD', rates.rates), currency: 'USD' };
}

/** Annual / 12, rounded once, in the same currency. */
export function monthlyOf(annual: Money): Money {
  return { amountMinor: monthlyEquivalentMinor(annual.amountMinor), currency: annual.currency };
}

/** Adds amounts that are all in one currency. */
export function sumMoney(amounts: Money[], currency: CurrencyCode): Money {
  return {
    amountMinor: amounts.reduce((total, amount) => total + amount.amountMinor, 0),
    currency,
  };
}

/**
 * Headcount with monthly and annual cost. On a view of every country the totals are in US
 * dollars whatever the toggle says (D28), while each country's row follows it.
 */
export async function insightsSummary(
  db: Database,
  scope: Scope,
  query: InsightsQuery,
  clock: Clock,
): Promise<InsightsSummary> {
  const country = viewCountry(scope, query.country);
  const totalsIn: DisplayCurrency = country === null ? 'USD' : query.currency;
  const [rows, rates] = await Promise.all([
    costByCountry(db, filtersFor(scope, query), today(clock)),
    ratesIf(totalsIn === 'USD' || query.currency === 'USD', db, clock),
  ]);

  const countries = rows.map((row) => {
    const annualCost = inDisplay(
      minorFrom(row.annual_minor),
      row.currency_code,
      query.currency,
      rates,
    );
    return {
      countryCode: row.country_code,
      headcount: row.headcount,
      annualCost,
      monthlyCost: monthlyOf(annualCost),
    };
  });
  const totalCurrency: CurrencyCode =
    country !== null && totalsIn === 'local' ? COUNTRIES[country].currencyCode : 'USD';
  const annualCost = sumMoney(
    rows.map((row) => inDisplay(minorFrom(row.annual_minor), row.currency_code, totalsIn, rates)),
    totalCurrency,
  );

  return {
    measure: query.measure,
    currency: query.currency,
    rateDate: rates?.rateDate ?? null,
    countryCode: country,
    headcount: rows.reduce((total, row) => total + row.headcount, 0),
    withoutPay: rows.reduce((total, row) => total + row.without_pay, 0),
    annualCost,
    monthlyCost: monthlyOf(annualCost),
    countries,
  };
}

/** Minimum, quartiles, median, maximum and average pay per country, for employees with pay. */
export async function payRanges(
  db: Database,
  scope: Scope,
  query: InsightsQuery,
  clock: Clock,
): Promise<PayRangeByCountryResponse> {
  const [rows, rates] = await Promise.all([
    payRangeByCountry(db, filtersFor(scope, query), today(clock)),
    ratesIf(query.currency === 'USD', db, clock),
  ]);

  return {
    measure: query.measure,
    currency: query.currency,
    rateDate: rates?.rateDate ?? null,
    items: rows.map((row) => {
      const money = (value: string, divisor = 1n) =>
        inDisplay(minorFrom(value, divisor), row.currency_code, query.currency, rates);
      return {
        countryCode: row.country_code,
        headcount: row.headcount,
        minimum: money(row.minimum_minor),
        lowerQuartile: money(row.lower_quartile_x4, 4n),
        median: money(row.median_x4, 4n),
        upperQuartile: money(row.upper_quartile_x4, 4n),
        maximum: money(row.maximum_minor),
        average: money(row.sum_minor, BigInt(row.headcount)),
      };
    }),
  };
}

/**
 * Pay per job title within one country (F7). A country HR user's country is used when none is
 * given; global HR users must choose one, since job titles are compared within a country.
 */
export async function jobTitlePay(
  db: Database,
  scope: Scope,
  query: InsightsQuery,
  clock: Clock,
): Promise<PayByJobTitleResponse> {
  const country = viewCountry(scope, query.country);
  if (country === null) {
    throw new RequestValidationError([
      { field: 'country', message: 'Choose a country to compare job titles' },
    ]);
  }
  const [rows, rates] = await Promise.all([
    payByJobTitle(db, { ...filtersFor(scope, query), country }, today(clock)),
    ratesIf(query.currency === 'USD', db, clock),
  ]);

  return {
    measure: query.measure,
    currency: query.currency,
    rateDate: rates?.rateDate ?? null,
    countryCode: country,
    items: rows.map((row) => {
      const money = (value: string, divisor = 1n) =>
        inDisplay(minorFrom(value, divisor), row.currency_code, query.currency, rates);
      return {
        jobTitle: row.job_title,
        headcount: row.headcount,
        average: money(row.sum_minor, BigInt(row.headcount)),
        median: money(row.median_x4, 4n),
        minimum: money(row.minimum_minor),
        maximum: money(row.maximum_minor),
      };
    }),
  };
}

/**
 * Monthly and annual cost per department, largest first. On a view of every country the costs
 * are added up in US dollars (D28); on a country view they follow the toggle.
 */
export async function departmentCosts(
  db: Database,
  scope: Scope,
  query: InsightsQuery,
  clock: Clock,
): Promise<CostByDepartmentResponse> {
  const country = viewCountry(scope, query.country);
  const costsIn: DisplayCurrency = country === null ? 'USD' : query.currency;
  const [rows, rates] = await Promise.all([
    costByDepartment(db, filtersFor(scope, query), today(clock)),
    ratesIf(costsIn === 'USD', db, clock),
  ]);

  const departments = new Map<string, { headcount: number; amounts: Money[] }>();
  for (const row of rows) {
    const entry = departments.get(row.department) ?? { headcount: 0, amounts: [] };
    entry.headcount += row.headcount;
    entry.amounts.push(inDisplay(minorFrom(row.annual_minor), row.currency_code, costsIn, rates));
    departments.set(row.department, entry);
  }
  const currency: CurrencyCode =
    country !== null && costsIn === 'local' ? COUNTRIES[country].currencyCode : 'USD';
  const items = [...departments].map(([department, { headcount, amounts }]) => {
    const annualCost = sumMoney(amounts, currency);
    return { department, headcount, annualCost, monthlyCost: monthlyOf(annualCost) };
  });
  items.sort(
    (a, b) =>
      b.annualCost.amountMinor - a.annualCost.amountMinor ||
      a.department.localeCompare(b.department),
  );

  return {
    measure: query.measure,
    currency: query.currency,
    rateDate: rates?.rateDate ?? null,
    countryCode: country,
    items,
  };
}
