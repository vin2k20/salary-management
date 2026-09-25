import { fromMinorUnits, type CurrencyCode, type PayMeasure } from '@salary/shared';

const countFormat = new Intl.NumberFormat('en-US');

/** A whole number with thousands separators, such as "9,500". */
export function formatCount(value: number): string {
  return countFormat.format(value);
}

/** Labels that follow the measure: cost to the company, or gross pay. */
export const MEASURE_LABELS: Record<PayMeasure, { name: string; annual: string; monthly: string }> =
  {
    total: { name: 'Total cost', annual: 'Annual cost', monthly: 'Monthly cost' },
    gross: { name: 'Gross pay', annual: 'Annual gross pay', monthly: 'Monthly gross pay' },
  };

/**
 * A short amount for chart axes, such as "$150K" or "₹12M". Axis ticks can fall between minor
 * units, so they are rounded first; exact amounts are always in the tables.
 */
export function formatCompactMoney(amountMinor: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(fromMinorUnits(Math.round(amountMinor), currency) as `${number}`);
}

/** "+61.5% above" or "-20.8% below". */
export function formatDifference(percent: number, direction: 'above' | 'below'): string {
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}% ${direction}`;
}
