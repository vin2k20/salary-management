import { describe, expect, it } from 'vitest';
import { formatDate } from './format.ts';

describe('formatDate', () => {
  it('writes dates as day, short month and year, the same in every browser', () => {
    expect(formatDate('2026-09-24')).toBe('24 Sep 2026');
    expect(formatDate('2026-01-05T23:30:00.000Z')).toBe('5 Jan 2026');
  });
});
