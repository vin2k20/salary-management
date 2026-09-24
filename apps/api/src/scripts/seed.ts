import { parseArgs } from 'node:util';
import { loadConfig } from '../config.ts';
import { createDatabase } from '../db/client.ts';
import { createLogger } from '../logger.ts';
import { DEFAULT_SEED_OPTIONS, seedDatabase } from '../seed/seed-database.ts';

// Usage: npm run db:seed -w @salary/api -- [--reset] [--count 10000] [--seed 20260924]
const { values } = parseArgs({
  options: {
    reset: { type: 'boolean', default: false },
    count: { type: 'string', default: String(DEFAULT_SEED_OPTIONS.count) },
    seed: { type: 'string', default: String(DEFAULT_SEED_OPTIONS.seed) },
  },
});

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
const { db, close } = createDatabase(config.databaseUrl);
const options = {
  ...DEFAULT_SEED_OPTIONS,
  count: Number(values.count),
  seed: Number(values.seed),
  reset: values.reset,
};

try {
  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error('--count must be a positive whole number');
  }
  const started = performance.now();
  const summary = await seedDatabase(db, options);
  logger.info(
    { ...summary, seconds: Math.round((performance.now() - started) / 100) / 10 },
    'Seed data loaded',
  );
} catch (error) {
  logger.fatal({ err: error }, 'Seeding failed');
  process.exitCode = 1;
} finally {
  await close();
}
