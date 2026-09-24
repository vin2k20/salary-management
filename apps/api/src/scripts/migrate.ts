import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadConfig } from '../config.ts';
import { createDatabase } from '../db/client.ts';
import { migrationsFolder } from '../db/migrations.ts';
import { createLogger } from '../logger.ts';

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const { db, close } = createDatabase(config.databaseUrl);

try {
  await migrate(db, { migrationsFolder });
  logger.info('Database migrations applied');
} catch (error) {
  logger.fatal({ err: error }, 'Database migrations failed');
  process.exitCode = 1;
} finally {
  await close();
}
