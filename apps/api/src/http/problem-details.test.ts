import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { errorHandler } from './problem-details.ts';

describe('problem details', () => {
  it('returns 404 for unknown routes', async () => {
    const response = await request(createApp()).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'No route matches GET /api/unknown',
      instance: '/api/unknown',
    });
  });

  it('returns 400 for a malformed JSON body', async () => {
    const response = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({ type: 'about:blank', title: 'Bad Request', status: 400 });
  });

  it('returns 500 without internal details for unexpected errors', async () => {
    const app = express();
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
    });
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });
});
