/**
 * Pay frequencies and the periods per year used to turn a per-period amount into annual and
 * monthly figures. "Bi-" means "every two". The same list is stored in the pay_frequencies table.
 */

export const PAY_FREQUENCIES = {
  weekly: { name: 'Weekly', periodsPerYear: 52 },
  bi_weekly: { name: 'Every two weeks', periodsPerYear: 26 },
  monthly: { name: 'Monthly', periodsPerYear: 12 },
  bi_monthly: { name: 'Every two months', periodsPerYear: 6 },
  quarterly: { name: 'Quarterly', periodsPerYear: 4 },
  bi_quarterly: { name: 'Every two quarters', periodsPerYear: 2 },
  half_yearly: { name: 'Half-yearly', periodsPerYear: 2 },
  yearly: { name: 'Yearly', periodsPerYear: 1 },
} as const;

export type PayFrequencyCode = keyof typeof PAY_FREQUENCIES;

export const PAY_FREQUENCY_CODES = Object.keys(PAY_FREQUENCIES) as PayFrequencyCode[];

export function periodsPerYear(frequency: PayFrequencyCode): number {
  return PAY_FREQUENCIES[frequency].periodsPerYear;
}

/** Annual amount in minor units: the per-period amount times the periods per year. */
export function annualAmountMinor(amountMinor: number, frequency: PayFrequencyCode): number {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error('Amounts in minor units must be safe whole numbers');
  }
  const annual = amountMinor * periodsPerYear(frequency);
  if (!Number.isSafeInteger(annual)) {
    throw new Error('Annual amount is too large');
  }
  return annual;
}

/**
 * Monthly equivalent of an annual amount, rounded to a whole minor unit with halves to the even
 * unit. Always derive it from the annual total, not by adding up rounded monthly amounts.
 */
export function monthlyEquivalentMinor(annualMinor: number): number {
  if (!Number.isSafeInteger(annualMinor)) {
    throw new Error('Amounts in minor units must be safe whole numbers');
  }
  const quotient = Math.trunc(annualMinor / 12);
  const remainder = Math.abs(annualMinor % 12);
  const direction = annualMinor < 0 ? -1 : 1;
  if (remainder > 6 || (remainder === 6 && Math.abs(quotient) % 2 === 1)) {
    return quotient + direction;
  }
  return quotient;
}
