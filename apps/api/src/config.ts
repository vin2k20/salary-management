import type { LevelWithSilent } from 'pino';
import { z } from 'zod';

export interface Config {
  port: number;
  logLevel: LevelWithSilent;
}

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

/** Reads configuration from environment variables and fails fast when a value is invalid. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return { port: result.data.PORT, logLevel: result.data.LOG_LEVEL };
}
