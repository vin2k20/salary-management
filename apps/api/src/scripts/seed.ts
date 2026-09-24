import { parseArgs } from 'node:util';
import { loadScriptConfig } from '../config.ts';
import { createDatabase } from '../db/client.ts';
import { createLogger } from '../logger.ts';
import { DEFAULT_SEED_OPTIONS, seedDatabase } from '../seed/seed-database.ts';
import { seedUsers } from '../seed/seed-users.ts';

// Usage: npm run db:seed -w @salary/api -- [--reset] [--count 10000] [--seed 20260924] [--users-only]
// The demo HR users get the password in SEED_HR_PASSWORD.
const { values } = parseArgs({
  options: {
    reset: { type: 'boolean', default: false },
    count: { type: 'string', default: String(DEFAULT_SEED_OPTIONS.count) },
    seed: { type: 'string', default: String(DEFAULT_SEED_OPTIONS.seed) },
    'users-only': { type: 'boolean', default: false },
  },
});

const config = loadScriptConfig(process.env);
const logger = createLogger(config.logLevel);
const { db, close } = createDatabase(config.databaseUrl);
const options = {
  ...DEFAULT_SEED_OPTIONS,
  count: Number(values.count),
  seed: Number(values.seed),
  reset: values.reset,
};

try {
  const password = process.env.SEED_HR_PASSWORD;
  if (!password) {
    throw new Error('Set SEED_HR_PASSWORD to the password for the demo HR users');
  }
  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error('--count must be a positive whole number');
  }
  const started = performance.now();
  const hrUsers = await seedUsers(db, password);
  const summary = values['users-only'] ? {} : await seedDatabase(db, options);
  logger.info(
    { hrUsers, ...summary, seconds: Math.round((performance.now() - started) / 100) / 10 },
    'Seed data loaded',
  );
} catch (error) {
  logger.fatal({ err: error }, 'Seeding failed');
  process.exitCode = 1;
} finally {
  await close();
}
