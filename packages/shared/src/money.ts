/**
 * Money is held as whole minor units (cents, paise) in a safe integer, with an ISO 4217 currency
 * code. Conversions go through strings and bigint, never floating point numbers.
 */

export const CURRENCIES = {
  USD: { name: 'US dollar', minorDigits: 2 },
  CAD: { name: 'Canadian dollar', minorDigits: 2 },
  AUD: { name: 'Australian dollar', minorDigits: 2 },
  INR: { name: 'Indian rupee', minorDigits: 2 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

const decimalPattern = /^(-)?(\d+)(?:\.(\d+))?$/;
const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);

export function minorDigits(currency: CurrencyCode): number {
  return CURRENCIES[currency].minorDigits;
}

/** Converts a decimal string such as "1234.56" to whole minor units. */
export function toMinorUnits(amount: string, currency: CurrencyCode): number {
  const match = decimalPattern.exec(amount);
  if (!match) {
    throw new Error(`"${amount}" is not a valid amount`);
  }
  const [, sign, whole = '', fraction = ''] = match;
  const digits = minorDigits(currency);
  if (fraction.length > digits) {
    throw new Error(`${currency} amounts have at most ${String(digits)} decimal places`);
  }
  const minor = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0'));
  if (minor > maxSafe) {
    throw new Error(`"${amount}" is too large`);
  }
  return Number(sign ? -minor : minor);
}

/** Converts whole minor units to a decimal string such as "1234.56". */
export function fromMinorUnits(amountMinor: number, currency: CurrencyCode): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error('Amounts in minor units must be safe whole numbers');
  }
  const digits = minorDigits(currency);
  const absolute = BigInt(Math.abs(amountMinor));
  const scale = 10n ** BigInt(digits);
  const whole = (absolute / scale).toString();
  const fraction = (absolute % scale).toString().padStart(digits, '0');
  const sign = amountMinor < 0 ? '-' : '';
  return digits === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

/** Formats an amount for display, for example "$1,234.56" or "₹1,23,456.78". */
export function formatMoney(amountMinor: number, currency: CurrencyCode, locale?: string): string {
  const digits = minorDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fromMinorUnits(amountMinor, currency) as `${number}`);
}
