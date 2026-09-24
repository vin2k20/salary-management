import { describe, expect, it } from 'vitest';
import {
  PAY_FREQUENCY_CODES,
  annualAmountMinor,
  monthlyEquivalentMinor,
  periodsPerYear,
} from './pay-frequency.ts';

const expectedPeriods = {
  weekly: 52,
  bi_weekly: 26,
  monthly: 12,
  bi_monthly: 6,
  quarterly: 4,
  bi_quarterly: 2,
  half_yearly: 2,
  yearly: 1,
};

describe('pay frequencies', () => {
  it('has the eight frequencies with their periods per year', () => {
    expect(PAY_FREQUENCY_CODES).toEqual(Object.keys(expectedPeriods));
    for (const [code, periods] of Object.entries(expectedPeriods)) {
      expect(periodsPerYear(code as keyof typeof expectedPeriods)).toBe(periods);
    }
  });
});

describe('annualAmountMinor', () => {
  it.each(Object.entries(expectedPeriods))(
    'multiplies a %s amount by its periods per year',
    (code, periods) => {
      expect(annualAmountMinor(384_615, code as keyof typeof expectedPeriods)).toBe(
        384_615 * periods,
      );
    },
  );

  it('rejects amounts that are not safe whole numbers', () => {
    expect(() => annualAmountMinor(10.5, 'monthly')).toThrow(/whole number/);
    expect(() => annualAmountMinor(Number.MAX_SAFE_INTEGER, 'weekly')).toThrow(/too large/);
  });
});

describe('monthlyEquivalentMinor', () => {
  it('divides the annual amount by twelve', () => {
    expect(monthlyEquivalentMinor(1_200_000)).toBe(100_000);
    expect(monthlyEquivalentMinor(0)).toBe(0);
  });

  it('rounds to the nearest minor unit, with halves to the even unit', () => {
    expect(monthlyEquivalentMinor(100)).toBe(8); // 8.33
    expect(monthlyEquivalentMinor(106)).toBe(9); // 8.83
    expect(monthlyEquivalentMinor(102)).toBe(8); // 8.5
    expect(monthlyEquivalentMinor(114)).toBe(10); // 9.5
  });

  it('matches the monthly amount for monthly pay', () => {
    expect(monthlyEquivalentMinor(annualAmountMinor(456_789, 'monthly'))).toBe(456_789);
  });
});
