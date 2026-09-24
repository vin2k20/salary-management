import { describe, expect, it } from 'vitest';
import { CURRENCY_CODES, formatMoney, fromMinorUnits, minorDigits, toMinorUnits } from './money.ts';

describe('currencies', () => {
  it('covers the four local currencies with two minor digits', () => {
    expect(CURRENCY_CODES).toEqual(['USD', 'CAD', 'AUD', 'INR']);
    for (const currency of CURRENCY_CODES) {
      expect(minorDigits(currency)).toBe(2);
    }
  });
});

describe('toMinorUnits', () => {
  it('converts decimal strings to whole minor units', () => {
    expect(toMinorUnits('1234.56', 'USD')).toBe(123456);
    expect(toMinorUnits('1234.5', 'INR')).toBe(123450);
    expect(toMinorUnits('1234', 'CAD')).toBe(123400);
    expect(toMinorUnits('0.01', 'AUD')).toBe(1);
    expect(toMinorUnits('-5.25', 'USD')).toBe(-525);
  });

  it('rejects more decimal places than the currency allows', () => {
    expect(() => toMinorUnits('1.234', 'USD')).toThrow(/decimal places/);
  });

  it('rejects text that is not a plain decimal number', () => {
    for (const value of ['', 'abc', '1e3', '1,000.00', '1.', '.5', ' 1']) {
      expect(() => toMinorUnits(value, 'USD')).toThrow(/not a valid amount/);
    }
  });

  it('rejects amounts too large to handle exactly', () => {
    expect(() => toMinorUnits('90071992547409.92', 'USD')).toThrow(/too large/);
  });
});

describe('fromMinorUnits', () => {
  it('converts minor units to a decimal string with the currency minor digits', () => {
    expect(fromMinorUnits(123456, 'USD')).toBe('1234.56');
    expect(fromMinorUnits(5, 'INR')).toBe('0.05');
    expect(fromMinorUnits(-525, 'USD')).toBe('-5.25');
    expect(fromMinorUnits(0, 'AUD')).toBe('0.00');
  });

  it('rejects amounts that are not safe whole numbers', () => {
    expect(() => fromMinorUnits(1.5, 'USD')).toThrow(/whole number/);
    expect(() => fromMinorUnits(Number.MAX_SAFE_INTEGER + 1, 'USD')).toThrow(/whole number/);
  });
});

describe('formatMoney', () => {
  it('formats amounts for display in the given locale', () => {
    expect(formatMoney(123456, 'USD', 'en-US')).toBe('$1,234.56');
    expect(formatMoney(12345678, 'INR', 'en-IN')).toBe('₹1,23,456.78');
    expect(formatMoney(123456, 'CAD', 'en-US')).toBe('CA$1,234.56');
  });

  it('keeps every digit of large amounts, without floating point rounding', () => {
    expect(formatMoney(Number.MAX_SAFE_INTEGER, 'USD', 'en-US')).toBe('$90,071,992,547,409.91');
  });
});
