import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { errorHandler, notFoundHandler } from './http/problem-details.ts';
import { requestLogger } from './http/request-logger.ts';
import { healthRouter } from './modules/health/health.routes.ts';

export interface AppDependencies {
  logger: Logger;
  generateRequestId?: () => string;
}

export function createApp({ logger, generateRequestId }: AppDependencies): Express {
  const app = express();

  app.use(helmet());
  app.use(requestLogger(logger, generateRequestId));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRouter());

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
