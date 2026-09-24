import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import type { Clock } from './clock.ts';
import type { Database } from './db/client.ts';
import { errorHandler, notFoundHandler } from './http/problem-details.ts';
import { requestLogger } from './http/request-logger.ts';
import { authRouter, type AuthSettings } from './modules/auth/auth.routes.ts';
import { requireAuth } from './modules/auth/require-auth.ts';
import { healthRouter } from './modules/health/health.routes.ts';

export interface AppDependencies {
  logger: Logger;
  db: Database;
  clock: Clock;
  auth: AuthSettings;
  generateRequestId?: () => string;
}

export function createApp({
  logger,
  db,
  clock,
  auth,
  generateRequestId,
}: AppDependencies): Express {
  const app = express();

  app.use(helmet());
  app.use(requestLogger(logger, generateRequestId));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRouter(db));
  app.use('/api/auth', authRouter({ db, clock, auth }));

  // Everything else under /api needs a session, so unknown paths answer 401 before 404.
  app.use('/api', requireAuth({ db, clock, jwtSecret: auth.jwtSecret }));

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
