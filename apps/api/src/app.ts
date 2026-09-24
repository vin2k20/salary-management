import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './http/problem-details.ts';
import { healthRouter } from './modules/health/health.routes.ts';

export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRouter());

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
