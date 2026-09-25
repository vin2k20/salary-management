import type { OutlierDirection } from './insights.ts';
import { divideHalfEven } from './rounding.ts';

/**
 * Peers share a country, job title and employment type. Pay more than `limitPercent` above or
 * below the peer median is flagged, but only in groups of at least `minimumGroupSize` people, so a
 * few people cannot make each other look unusual (D32).
 */
export const PEER_COMPARISON = { limitPercent: 20, minimumGroupSize: 5 } as const;

export interface PeerComparison {
  flagged: boolean;
  direction: OutlierDirection | null;
  /** Difference from the median in percent, one decimal place, halves to even. */
  differencePercent: number;
}

/**
 * Compares annual pay with the peer median, both in whole minor units of the same currency. The
 * test is exact integer arithmetic: |pay - median| x 100 > median x limit. The API applies the
 * same inequality in SQL, so the list it returns matches this rule.
 */
export function comparePeerPay(
  payMinor: number,
  peerMedianMinor: number,
  limitPercent: number = PEER_COMPARISON.limitPercent,
): PeerComparison {
  if (!Number.isSafeInteger(payMinor) || !Number.isSafeInteger(peerMedianMinor)) {
    throw new Error('Amounts in minor units must be safe whole numbers');
  }
  if (peerMedianMinor <= 0) throw new Error('The peer median must be positive');
  const difference = BigInt(payMinor) - BigInt(peerMedianMinor);
  const median = BigInt(peerMedianMinor);
  const distance = difference < 0n ? -difference : difference;
  let direction: OutlierDirection | null = null;
  if (difference > 0n) direction = 'above';
  if (difference < 0n) direction = 'below';
  return {
    flagged: distance * 100n > median * BigInt(limitPercent),
    direction,
    differencePercent: Number(divideHalfEven(difference * 1000n, median)) / 10,
  };
}
