import { createApp } from './app.ts';
import { systemClock } from './clock.ts';
import { loadConfig } from './config.ts';
import { createDatabase } from './db/client.ts';
import { createLogger } from './logger.ts';

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const database = createDatabase(config.databaseUrl);
const app = createApp({
  logger,
  db: database.db,
  clock: systemClock,
  auth: { jwtSecret: config.jwtSecret, secureCookies: config.nodeEnv === 'production' },
  trustProxy: config.trustProxy,
});

const server = app.listen(config.port, (error) => {
  if (error) {
    logger.fatal({ err: error }, 'API failed to start');
    process.exit(1);
  }
  logger.info({ port: config.port }, 'API listening');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'API shutting down');
    server.close(() => {
      void database.close().finally(() => process.exit(0));
    });
  });
}
