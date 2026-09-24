import type { Express } from 'express';
import { createApp } from '../app.ts';
import { createLogger } from '../logger.ts';

export type LogLine = Record<string, unknown>;

/** Creates the app with a fixed request ID and a logger that keeps lines in memory. */
export function createTestApp(): { app: Express; logLines: LogLine[] } {
  const logLines: LogLine[] = [];
  const logger = createLogger('info', {
    write: (line: string) => {
      logLines.push(JSON.parse(line) as LogLine);
    },
  });
  const app = createApp({ logger, generateRequestId: () => 'req-1' });
  return { app, logLines };
}
