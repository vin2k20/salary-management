import type { LevelWithSilent } from 'pino';
import { z } from 'zod';

export interface ScriptConfig {
  logLevel: LevelWithSilent;
  databaseUrl: string;
}

export interface Config extends ScriptConfig {
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  jwtSecret: string;
}

const scriptEnvSchema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL is required' })
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a PostgreSQL connection string'),
});

const serverEnvSchema = scriptEnvSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z
    .string({ error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters'),
});

function parse<T extends z.ZodType>(schema: T, env: Record<string, string | undefined>) {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Settings for scripts such as migrations and seeding, which only need the database. */
export function loadScriptConfig(env: Record<string, string | undefined>): ScriptConfig {
  const data = parse(scriptEnvSchema, env);
  return { logLevel: data.LOG_LEVEL, databaseUrl: data.DATABASE_URL };
}

/** Reads the API settings from environment variables and fails fast when a value is invalid. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const data = parse(serverEnvSchema, env);
  return {
    port: data.PORT,
    logLevel: data.LOG_LEVEL,
    databaseUrl: data.DATABASE_URL,
    nodeEnv: data.NODE_ENV,
    jwtSecret: data.JWT_SECRET,
  };
}
