import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createLogger } from './logger.ts';

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const app = createApp({ logger });

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
    server.close(() => process.exit(0));
  });
}
