import { describe, expect, it } from 'vitest';
import { PEER_COMPARISON, comparePeerPay } from './peer-comparison.ts';

describe('comparePeerPay', () => {
  it('keeps the limit and the minimum group size in one configuration value', () => {
    expect(PEER_COMPARISON).toEqual({ limitPercent: 20, minimumGroupSize: 5 });
  });

  it('flags pay more than 20% above the peer median', () => {
    expect(comparePeerPay(1_200_001, 1_000_000)).toEqual({
      flagged: true,
      direction: 'above',
      differencePercent: 20,
    });
    expect(comparePeerPay(1_500_000, 1_000_000)).toMatchObject({
      flagged: true,
      differencePercent: 50,
    });
  });

  it('flags pay more than 20% below the peer median', () => {
    expect(comparePeerPay(799_999, 1_000_000)).toEqual({
      flagged: true,
      direction: 'below',
      differencePercent: -20,
    });
  });

  it('does not flag pay exactly 20% away from the median', () => {
    expect(comparePeerPay(1_200_000, 1_000_000)).toMatchObject({ flagged: false });
    expect(comparePeerPay(800_000, 1_000_000)).toMatchObject({ flagged: false });
  });

  it('does not flag pay equal to the median', () => {
    expect(comparePeerPay(1_000_000, 1_000_000)).toEqual({
      flagged: false,
      direction: null,
      differencePercent: 0,
    });
  });

  it('rounds the difference to one decimal place, halves to even', () => {
    // 1,234 is 23.4% above 1,000; 1,000,250 is 0.025% above 1,000,000, shown as 0.0%.
    expect(comparePeerPay(1_234, 1_000).differencePercent).toBe(23.4);
    expect(comparePeerPay(1_000_250, 1_000_000).differencePercent).toBe(0);
    expect(comparePeerPay(1_000_750, 1_000_000).differencePercent).toBe(0.1);
    expect(comparePeerPay(2, 3).differencePercent).toBe(-33.3);
  });

  it('compares large amounts exactly, without floating point', () => {
    // 20% of 4,000,000,000,001 is 800,000,000,000.2, so one more minor unit crosses the limit.
    expect(comparePeerPay(4_800_000_000_001, 4_000_000_000_001)).toMatchObject({ flagged: false });
    expect(comparePeerPay(4_800_000_000_002, 4_000_000_000_001)).toMatchObject({ flagged: true });
  });

  it('accepts another limit for the same rule', () => {
    expect(comparePeerPay(1_150_000, 1_000_000, 10)).toMatchObject({ flagged: true });
  });

  it('needs a positive median', () => {
    expect(() => comparePeerPay(100, 0)).toThrow(/positive/);
  });
});
