import { healthResponseSchema } from '@salary/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/test-app.ts';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(healthResponseSchema.parse(response.body)).toEqual({ status: 'ok' });
  });
});
