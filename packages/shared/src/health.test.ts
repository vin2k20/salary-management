import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.ts';

describe('healthResponseSchema', () => {
  it('accepts a healthy API and database', () => {
    expect(healthResponseSchema.parse({ status: 'ok', database: 'ok' })).toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('accepts a degraded API when the database is unavailable', () => {
    expect(healthResponseSchema.parse({ status: 'degraded', database: 'unavailable' })).toEqual({
      status: 'degraded',
      database: 'unavailable',
    });
  });

  it('rejects any other status', () => {
    expect(healthResponseSchema.safeParse({ status: 'down', database: 'ok' }).success).toBe(false);
    expect(healthResponseSchema.safeParse({ status: 'ok' }).success).toBe(false);
  });
});
