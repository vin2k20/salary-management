import type { Express } from 'express';
import { createApp } from '../app.ts';
import type { Clock } from '../clock.ts';
import type { Database } from '../db/client.ts';
import type { EmailMessage } from '../email/email-sender.ts';
import { createLogger } from '../logger.ts';
import { createRecordingEmailSender } from './email.ts';
import { createTestDatabase, type TestDatabase } from './test-database.ts';

export type LogLine = Record<string, unknown>;

export const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

export const TEST_APP_URL = 'http://app.test';

/** A clock that tests can move forward. */
export function testClock(start = '2026-09-24T10:00:00Z'): Clock & { advance(ms: number): void } {
  let now = new Date(start).getTime();
  return {
    now: () => new Date(now),
    advance: (ms) => {
      now += ms;
    },
  };
}

let sharedDatabase: Promise<TestDatabase> | undefined;

/** One migrated in-memory database per test file, created on first use. */
export function sharedTestDatabase(): Promise<TestDatabase> {
  sharedDatabase ??= createTestDatabase();
  return sharedDatabase;
}

/**
 * Creates the app with a fixed request ID, a logger that keeps lines in memory, a test clock, an
 * email sender that records messages and, unless one is given, the shared test database.
 */
export async function createTestApp(
  options: { db?: Database; clock?: Clock; secureCookies?: boolean } = {},
): Promise<{ app: Express; logLines: LogLine[]; emails: EmailMessage[] }> {
  const logLines: LogLine[] = [];
  const logger = createLogger('info', {
    write: (line: string) => {
      logLines.push(JSON.parse(line) as LogLine);
    },
  });
  const db = options.db ?? (await sharedTestDatabase()).db;
  const emailSender = createRecordingEmailSender();
  const app = createApp({
    logger,
    db,
    clock: options.clock ?? testClock(),
    auth: { jwtSecret: TEST_JWT_SECRET, secureCookies: options.secureCookies ?? false },
    emailSender,
    appUrl: TEST_APP_URL,
    generateRequestId: () => 'req-1',
  });
  return { app, logLines, emails: emailSender.sent };
}
