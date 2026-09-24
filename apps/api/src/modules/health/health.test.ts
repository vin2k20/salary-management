import { healthResponseSchema } from '@salary/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/test-app.ts';
import { createTestDatabase } from '../../test/test-database.ts';

describe('GET /api/health', () => {
  it('returns ok when the database answers', async () => {
    const { app } = await createTestApp();

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(healthResponseSchema.parse(response.body)).toEqual({ status: 'ok', database: 'ok' });
  });

  it('returns 503 and logs a warning when the database is unavailable', async () => {
    const unavailable = await createTestDatabase();
    await unavailable.close();
    const { app, logLines } = await createTestApp({ db: unavailable.db });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(healthResponseSchema.parse(response.body)).toEqual({
      status: 'degraded',
      database: 'unavailable',
    });
    expect(logLines).toContainEqual(
      expect.objectContaining({ level: 40, msg: 'Database health check failed' }),
    );
  });
});
