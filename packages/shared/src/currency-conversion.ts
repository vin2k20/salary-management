import { STALE_RATES_AFTER_DAYS } from './fx-rates.ts';
import { minorDigits, type CurrencyCode } from './money.ts';

/** Units of each currency per US dollar, as exact decimal strings ("95.96"). */
export type UnitsPerUsd = Partial<Record<CurrencyCode, string>>;

/** A decimal string as an integer and a power of ten: "95.96" is 9596 / 10^2. */
function parseDecimal(value: string): { units: bigint; scale: bigint } {
  const [whole = '0', fraction = ''] = value.split('.');
  return { units: BigInt(whole + fraction), scale: 10n ** BigInt(fraction.length) };
}

/** Divides and rounds half to even, with bigint so no precision is lost. */
function divideHalfEven(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  let quotient = n / d;
  const twiceRemainder = (n % d) * 2n;
  if (twiceRemainder > d || (twiceRemainder === d && quotient % 2n === 1n)) quotient += 1n;
  return negative ? -quotient : quotient;
}

function rateFor(currency: CurrencyCode, rates: UnitsPerUsd) {
  const rate = rates[currency];
  if (rate === undefined) throw new Error(`No exchange rate for ${currency}`);
  return parseDecimal(rate);
}

/**
 * Converts an amount in minor units from one currency to another through the US dollar, using
 * rates in units per dollar. The result is exact until the final rounding, half to even.
 */
export function convertMinor(
  amountMinor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: UnitsPerUsd,
): number {
  if (from === to) return amountMinor;
  const source = rateFor(from, rates);
  const target = rateFor(to, rates);
  const digitShift = minorDigits(to) - minorDigits(from);

  // amount x (target rate / source rate), with both rates and minor digits kept as integers.
  let numerator = BigInt(amountMinor) * target.units * source.scale;
  let denominator = source.units * target.scale;
  if (digitShift > 0) numerator *= 10n ** BigInt(digitShift);
  if (digitShift < 0) denominator *= 10n ** BigInt(-digitShift);

  const result = divideHalfEven(numerator, denominator);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Converted amount is too large');
  }
  return Number(result);
}

/** The latest rate for a currency on or before a date (YYYY-MM-DD), from stored history. */
export function rateOnOrBefore(
  history: { currencyCode: CurrencyCode; rateDate: string; unitsPerUsd: string }[],
  currency: CurrencyCode,
  date: string,
): string | undefined {
  let best: { rateDate: string; unitsPerUsd: string } | undefined;
  for (const row of history) {
    if (row.currencyCode !== currency || row.rateDate > date) continue;
    if (!best || row.rateDate > best.rateDate) best = row;
  }
  return best?.unitsPerUsd;
}

/** True when the rate date is more than STALE_RATES_AFTER_DAYS days before today, or unknown. */
export function isStale(rateDate: string | null, today: string): boolean {
  if (rateDate === null) return true;
  const days =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${rateDate}T00:00:00Z`)) / 86_400_000;
  return days > STALE_RATES_AFTER_DAYS;
}
