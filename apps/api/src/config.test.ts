import { describe, expect, it } from 'vitest';
import { loadConfig, loadScriptConfig } from './config.ts';

const databaseUrl = 'postgresql://user:password@localhost:5432/salary';
const jwtSecret = 'a-test-secret-that-is-long-enough-for-hs256';
const required = { DATABASE_URL: databaseUrl, JWT_SECRET: jwtSecret };

describe('loadConfig', () => {
  it('uses defaults when optional variables are not set', () => {
    expect(loadConfig(required)).toEqual({
      port: 3000,
      logLevel: 'info',
      databaseUrl,
      nodeEnv: 'development',
      jwtSecret,
    });
  });

  it('reads the port, log level and environment', () => {
    expect(
      loadConfig({ ...required, PORT: '4000', LOG_LEVEL: 'debug', NODE_ENV: 'production' }),
    ).toMatchObject({ port: 4000, logLevel: 'debug', nodeEnv: 'production' });
  });

  it('rejects an invalid port or log level', () => {
    expect(() => loadConfig({ ...required, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...required, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });

  it('requires a PostgreSQL connection string without echoing it', () => {
    expect(() => loadConfig({ JWT_SECRET: jwtSecret })).toThrow(/DATABASE_URL is required/);
    expect(() => loadConfig({ ...required, DATABASE_URL: 'mysql://secret@host/db' })).toThrow(
      /DATABASE_URL must be a PostgreSQL connection string/,
    );
    expect(() => loadConfig({ ...required, DATABASE_URL: 'mysql://secret@host/db' })).not.toThrow(
      /secret/,
    );
  });

  it('requires a JWT secret of at least 32 characters without echoing it', () => {
    expect(() => loadConfig({ DATABASE_URL: databaseUrl })).toThrow(/JWT_SECRET is required/);
    expect(() => loadConfig({ ...required, JWT_SECRET: 'short-secret' })).toThrow(
      /JWT_SECRET must be at least 32 characters/,
    );
    expect(() => loadConfig({ ...required, JWT_SECRET: 'short-secret' })).not.toThrow(
      /short-secret/,
    );
  });
});

describe('loadScriptConfig', () => {
  it('needs only the database, not the JWT secret', () => {
    expect(loadScriptConfig({ DATABASE_URL: databaseUrl })).toEqual({
      logLevel: 'info',
      databaseUrl,
    });
  });
});
