import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

const databaseUrl = 'postgresql://user:password@localhost:5432/salary';

describe('loadConfig', () => {
  it('uses defaults when optional variables are not set', () => {
    expect(loadConfig({ DATABASE_URL: databaseUrl })).toEqual({
      port: 3000,
      logLevel: 'info',
      databaseUrl,
    });
  });

  it('reads the port and log level', () => {
    expect(loadConfig({ PORT: '4000', LOG_LEVEL: 'debug', DATABASE_URL: databaseUrl })).toEqual({
      port: 4000,
      logLevel: 'debug',
      databaseUrl,
    });
  });

  it('rejects an invalid port or log level', () => {
    expect(() => loadConfig({ PORT: 'abc', DATABASE_URL: databaseUrl })).toThrow(/PORT/);
    expect(() => loadConfig({ LOG_LEVEL: 'loud', DATABASE_URL: databaseUrl })).toThrow(/LOG_LEVEL/);
  });

  it('requires a PostgreSQL connection string without echoing it', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL is required/);
    expect(() => loadConfig({ DATABASE_URL: 'mysql://secret@host/db' })).toThrow(
      /DATABASE_URL must be a PostgreSQL connection string/,
    );
    expect(() => loadConfig({ DATABASE_URL: 'mysql://secret@host/db' })).not.toThrow(/secret/);
  });
});
