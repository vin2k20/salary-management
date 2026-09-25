import { describe, expect, it } from 'vitest';
import { divideHalfEven } from './rounding.ts';

describe('divideHalfEven', () => {
  it('divides exactly when there is no remainder', () => {
    expect(divideHalfEven(12n, 4n)).toBe(3n);
  });

  it('rounds to the nearest whole number', () => {
    expect(divideHalfEven(11n, 4n)).toBe(3n); // 2.75
    expect(divideHalfEven(9n, 4n)).toBe(2n); // 2.25
  });

  it('rounds halves to the even number', () => {
    expect(divideHalfEven(10n, 4n)).toBe(2n); // 2.5
    expect(divideHalfEven(14n, 4n)).toBe(4n); // 3.5
    expect(divideHalfEven(-10n, 4n)).toBe(-2n);
    expect(divideHalfEven(-14n, 4n)).toBe(-4n);
  });

  it('keeps precision beyond the safe integer range', () => {
    expect(divideHalfEven(10n ** 20n + 1n, 2n)).toBe(5n * 10n ** 19n);
  });
});
