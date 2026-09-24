import type { Express } from 'express';
import { createApp } from '../app.ts';
import type { Database } from '../db/client.ts';
import { createLogger } from '../logger.ts';
import { createTestDatabase, type TestDatabase } from './test-database.ts';

export type LogLine = Record<string, unknown>;

let sharedDatabase: Promise<TestDatabase> | undefined;

/** One migrated in-memory database per test file, created on first use. */
export function sharedTestDatabase(): Promise<TestDatabase> {
  sharedDatabase ??= createTestDatabase();
  return sharedDatabase;
}

/**
 * Creates the app with a fixed request ID, a logger that keeps lines in memory and, unless one is
 * given, the shared test database.
 */
export async function createTestApp(
  options: { db?: Database } = {},
): Promise<{ app: Express; logLines: LogLine[] }> {
  const logLines: LogLine[] = [];
  const logger = createLogger('info', {
    write: (line: string) => {
      logLines.push(JSON.parse(line) as LogLine);
    },
  });
  const db = options.db ?? (await sharedTestDatabase()).db;
  const app = createApp({ logger, db, generateRequestId: () => 'req-1' });
  return { app, logLines };
}
