import express, { type Express } from 'express';
import { healthRouter } from './modules/health/health.routes.ts';

export function createApp(): Express {
  const app = express();

  app.use('/api/health', healthRouter());

  return app;
}
