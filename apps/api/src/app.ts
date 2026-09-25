import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import type { Clock } from './clock.ts';
import type { Database } from './db/client.ts';
import type { EmailSender } from './email/email-sender.ts';
import { errorHandler, notFoundHandler } from './http/problem-details.ts';
import { requestLogger } from './http/request-logger.ts';
import { authRouter, type AuthSettings } from './modules/auth/auth.routes.ts';
import { requireAuth } from './modules/auth/require-auth.ts';
import { compensationRouter } from './modules/compensation/compensation.routes.ts';
import { employeesRouter, referenceRouter } from './modules/employees/employees.routes.ts';
import type { RateProvider } from './modules/fx-rates/frankfurter-client.ts';
import { fxRatesRouter, internalFxRatesRouter } from './modules/fx-rates/fx-rates.routes.ts';
import { healthRouter } from './modules/health/health.routes.ts';
import { insightsRouter } from './modules/insights/insights.routes.ts';
import { payComponentsRouter } from './modules/pay-components/pay-components.routes.ts';
import { usersRouter } from './modules/users/users.routes.ts';

export interface AppDependencies {
  logger: Logger;
  db: Database;
  clock: Clock;
  auth: AuthSettings;
  emailSender: EmailSender;
  /** Base address of the web app, for links in emails. */
  appUrl: string;
  rateProvider: RateProvider;
  /** Secret for the scheduled rates refresh; null switches that endpoint off. */
  ratesRefreshSecret: string | null;
  /** Trust X-Forwarded-For from the proxies in front of the API (Vercel and Render). */
  trustProxy?: boolean;
  generateRequestId?: () => string;
}

export function createApp({
  logger,
  db,
  clock,
  auth,
  emailSender,
  appUrl,
  rateProvider,
  ratesRefreshSecret,
  trustProxy = false,
  generateRequestId,
}: AppDependencies): Express {
  const app = express();
  app.set('trust proxy', trustProxy);

  app.use(helmet());
  app.use(requestLogger(logger, generateRequestId));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRouter(db));
  app.use('/api/auth', authRouter({ db, clock, auth, emailSender, appUrl }));
  app.use(
    '/api/internal/fx-rates',
    internalFxRatesRouter({ db, clock, rateProvider, secret: ratesRefreshSecret }),
  );

  // Everything else under /api needs a session, so unknown paths answer 401 before 404.
  app.use('/api', requireAuth({ db, clock, jwtSecret: auth.jwtSecret }));
  app.use('/api/users', usersRouter({ db, clock, emailSender, appUrl }));
  app.use('/api/fx-rates', fxRatesRouter({ db, clock, rateProvider }));
  app.use('/api/employees', employeesRouter({ db, clock }));
  app.use('/api/employees', compensationRouter({ db, clock }));
  app.use('/api/reference', referenceRouter({ db }));
  app.use('/api/pay-components', payComponentsRouter({ db, clock }));
  app.use('/api/insights', insightsRouter({ db, clock }));

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
