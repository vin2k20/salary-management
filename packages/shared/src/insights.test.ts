import { describe, expect, it } from 'vitest';
import { insightsQuerySchema, outliersQuerySchema } from './insights.ts';

describe('insightsQuerySchema', () => {
  it('shows total pay for every country in local currency, without inactive employees', () => {
    expect(insightsQuerySchema.parse({})).toEqual({
      measure: 'total',
      currency: 'local',
      includeInactive: false,
    });
  });

  it('reads the query string, treating empty values as not set', () => {
    expect(
      insightsQuerySchema.parse({
        country: 'IN',
        measure: 'gross',
        currency: 'USD',
        includeInactive: 'true',
      }),
    ).toEqual({ country: 'IN', measure: 'gross', currency: 'USD', includeInactive: true });
    expect(insightsQuerySchema.parse({ country: '', measure: '' })).toMatchObject({
      measure: 'total',
    });
  });

  it('rejects unknown countries and measures', () => {
    expect(insightsQuerySchema.safeParse({ country: 'GB' }).success).toBe(false);
    expect(insightsQuerySchema.safeParse({ measure: 'base' }).success).toBe(false);
  });
});

describe('outliersQuerySchema', () => {
  it('pages 25 employees at a time, in both directions by default', () => {
    expect(outliersQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 25 });
    expect(outliersQuerySchema.parse({}).direction).toBeUndefined();
  });

  it('limits the page size and direction', () => {
    expect(outliersQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(outliersQuerySchema.safeParse({ direction: 'sideways' }).success).toBe(false);
    expect(outliersQuerySchema.parse({ direction: 'below', page: '3' })).toMatchObject({
      direction: 'below',
      page: 3,
    });
  });
});
