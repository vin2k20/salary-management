import { describe, expect, it } from 'vitest';
import { convertMinor, isStale, rateOnOrBefore } from './currency-conversion.ts';

const rates = { USD: '1', CAD: '1.4117', AUD: '1.4232', INR: '95.96' } as const;

describe('convertMinor', () => {
  it('converts local currency to US dollars with the rate per dollar', () => {
    // 80,000 INR at 95.96 per dollar is 833.68 USD.
    expect(convertMinor(8_000_000, 'INR', 'USD', rates)).toBe(83_368);
  });

  it('converts US dollars to local currency', () => {
    expect(convertMinor(10_000, 'USD', 'INR', rates)).toBe(959_600);
  });

  it('converts between two local currencies through the dollar', () => {
    // 1,000 CAD x 1.4232 / 1.4117 = 1,008.1462 AUD.
    expect(convertMinor(100_000, 'CAD', 'AUD', rates)).toBe(100_815);
  });

  it('leaves an amount in the same currency unchanged', () => {
    expect(convertMinor(123_456, 'AUD', 'AUD', rates)).toBe(123_456);
  });

  it('rounds half to the even minor unit, without floating point', () => {
    const half = { USD: '1', INR: '2' } as const;
    expect(convertMinor(1, 'INR', 'USD', half)).toBe(0); // 0.5
    expect(convertMinor(3, 'INR', 'USD', half)).toBe(2); // 1.5
    expect(convertMinor(-3, 'INR', 'USD', half)).toBe(-2);
    expect(convertMinor(Number.MAX_SAFE_INTEGER, 'USD', 'USD', rates)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('refuses to convert without a rate for the currency', () => {
    expect(() => convertMinor(100, 'INR', 'USD', { USD: '1' })).toThrow(/No exchange rate for INR/);
  });
});

describe('rateOnOrBefore', () => {
  const history = [
    { currencyCode: 'INR' as const, rateDate: '2026-09-21', unitsPerUsd: '95.10' },
    { currencyCode: 'INR' as const, rateDate: '2026-09-23', unitsPerUsd: '95.80' },
    { currencyCode: 'INR' as const, rateDate: '2026-09-24', unitsPerUsd: '95.96' },
    { currencyCode: 'CAD' as const, rateDate: '2026-09-24', unitsPerUsd: '1.4117' },
  ];

  it('uses the latest rate on or before the date', () => {
    expect(rateOnOrBefore(history, 'INR', '2026-09-24')).toBe('95.96');
    expect(rateOnOrBefore(history, 'INR', '2026-09-22')).toBe('95.10');
  });

  it('has no rate before the first stored date', () => {
    expect(rateOnOrBefore(history, 'INR', '2026-09-20')).toBeUndefined();
    expect(rateOnOrBefore(history, 'AUD', '2026-09-24')).toBeUndefined();
  });
});

describe('isStale', () => {
  it('flags rates more than three days old', () => {
    expect(isStale('2026-09-21', '2026-09-24')).toBe(false);
    expect(isStale('2026-09-20', '2026-09-24')).toBe(true);
    expect(isStale(null, '2026-09-24')).toBe(true);
  });
});
