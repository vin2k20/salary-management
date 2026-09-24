import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../logger.ts';
import { createTestApp, type LogLine } from '../test/test-app.ts';
import { errorHandler } from './problem-details.ts';
import { requestLogger } from './request-logger.ts';

describe('problem details', () => {
  it('returns 404 for unknown routes', async () => {
    const { app } = await createTestApp();

    const response = await request(app).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'No route matches GET /api/unknown',
      instance: '/api/unknown',
      requestId: 'req-1',
    });
  });

  it('returns 400 for a malformed JSON body', async () => {
    const { app } = await createTestApp();

    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({ type: 'about:blank', title: 'Bad Request', status: 400 });
  });

  it('returns 500 without internal details and logs the error on the server', async () => {
    const logLines: LogLine[] = [];
    const logger = createLogger('info', {
      write: (line: string) => {
        logLines.push(JSON.parse(line) as LogLine);
      },
    });
    const app = express();
    app.use(requestLogger(logger, () => 'req-1'));
    app.get('/boom', () => {
      throw new Error('connection string with a secret');
    });
    app.use(errorHandler());

    const response = await request(app).get('/boom');

    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      instance: '/boom',
      requestId: 'req-1',
    });
    expect(JSON.stringify(response.body)).not.toContain('secret');
    expect(logLines).toContainEqual(
      expect.objectContaining({
        level: 50,
        err: expect.objectContaining({ message: 'connection string with a secret' }) as unknown,
      }),
    );
  });
});
