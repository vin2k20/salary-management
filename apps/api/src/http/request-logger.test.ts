import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../test/test-app.ts';

describe('security headers and request logging', () => {
  it('sets security headers', async () => {
    const { app } = await createTestApp();

    const response = await request(app).get('/api/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a generated request ID', async () => {
    const { app } = await createTestApp();

    const response = await request(app).get('/api/health');

    expect(response.headers['x-request-id']).toBe('req-1');
  });

  it('reuses a valid incoming request ID and ignores an invalid one', async () => {
    const { app } = await createTestApp();

    const valid = await request(app).get('/api/health').set('X-Request-Id', 'abc-123');
    const invalid = await request(app).get('/api/health').set('X-Request-Id', 'not valid!');

    expect(valid.headers['x-request-id']).toBe('abc-123');
    expect(invalid.headers['x-request-id']).toBe('req-1');
  });

  it('includes the request ID in problem details', async () => {
    const { app } = await createTestApp();

    const response = await request(app).get('/api/unknown');

    expect(response.body).toMatchObject({ status: 404, requestId: 'req-1' });
  });

  it('logs each request with its ID, method, path and status, without query or headers', async () => {
    const { app, logLines } = await createTestApp();

    await request(app).get('/api/health?search=someone').set('Cookie', 'session=secret');

    expect(logLines).toContainEqual(
      expect.objectContaining({
        req: { id: 'req-1', method: 'GET', path: '/api/health' },
        res: { statusCode: 200 },
      }),
    );
    const logged = JSON.stringify(logLines);
    expect(logged).not.toContain('someone');
    expect(logged).not.toContain('secret');
  });
});
