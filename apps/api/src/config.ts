import { FILE_TRANSFER_MODES, type FileTransferMode } from '@salary/shared';
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
  trustProxy: boolean;
  appUrl: string;
  /** Secret for the scheduled rates refresh; null when not set, which switches it off. */
  ratesRefreshSecret: string | null;
  email:
    | { transport: 'console' }
    | { transport: 'brevo'; apiKey: string; from: { email: string; name: string } };
  /** Import and export run only when enabled; paused by default on the free plan (D59). */
  fileTransfers: FileTransferMode;
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
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  APP_URL: z.url('APP_URL must be the web app address').default('http://localhost:5173'),
  EMAIL_TRANSPORT: z.enum(['console', 'brevo']).default('console'),
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.email('EMAIL_FROM must be an email address').optional(),
  EMAIL_FROM_NAME: z.string().default('ACME Salary Management'),
  RATES_REFRESH_SECRET: z
    .string()
    .min(32, 'RATES_REFRESH_SECRET must be at least 32 characters')
    .optional(),
  FILE_TRANSFERS: z.enum(FILE_TRANSFER_MODES).default('paused'),
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
  if (data.EMAIL_TRANSPORT === 'console' && data.NODE_ENV === 'production') {
    throw new Error(
      'EMAIL_TRANSPORT=console writes reset links to the log; use brevo in production',
    );
  }
  if (data.EMAIL_TRANSPORT === 'brevo' && (!data.BREVO_API_KEY || !data.EMAIL_FROM)) {
    throw new Error('EMAIL_TRANSPORT=brevo needs BREVO_API_KEY and EMAIL_FROM');
  }
  return {
    port: data.PORT,
    logLevel: data.LOG_LEVEL,
    databaseUrl: data.DATABASE_URL,
    nodeEnv: data.NODE_ENV,
    jwtSecret: data.JWT_SECRET,
    trustProxy: data.TRUST_PROXY === 'true',
    appUrl: data.APP_URL,
    ratesRefreshSecret: data.RATES_REFRESH_SECRET ?? null,
    email:
      data.EMAIL_TRANSPORT === 'brevo'
        ? {
            transport: 'brevo',
            apiKey: data.BREVO_API_KEY ?? '',
            from: { email: data.EMAIL_FROM ?? '', name: data.EMAIL_FROM_NAME },
          }
        : { transport: 'console' },
    fileTransfers: data.FILE_TRANSFERS,
  };
}
