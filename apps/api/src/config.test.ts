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
      trustProxy: false,
      appUrl: 'http://localhost:5173',
      ratesRefreshSecret: null,
      email: { transport: 'console' },
      fileTransfers: 'paused',
    });
  });

  it('switches import and export on only when asked', () => {
    expect(loadConfig({ ...required, FILE_TRANSFERS: 'enabled' }).fileTransfers).toBe('enabled');
    expect(() => loadConfig({ ...required, FILE_TRANSFERS: 'on' })).toThrow(/FILE_TRANSFERS/);
  });

  it('reads the port, log level and environment', () => {
    expect(
      loadConfig({
        ...required,
        PORT: '4000',
        LOG_LEVEL: 'debug',
        NODE_ENV: 'production',
        TRUST_PROXY: 'true',
        EMAIL_TRANSPORT: 'brevo',
        BREVO_API_KEY: 'xkeysib-test',
        EMAIL_FROM: 'sender@example.com',
      }),
    ).toMatchObject({ port: 4000, logLevel: 'debug', nodeEnv: 'production', trustProxy: true });
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

describe('email settings', () => {
  it('uses Brevo with a key and a verified sender', () => {
    expect(
      loadConfig({
        ...required,
        EMAIL_TRANSPORT: 'brevo',
        BREVO_API_KEY: 'xkeysib-test',
        EMAIL_FROM: 'sender@example.com',
      }).email,
    ).toEqual({
      transport: 'brevo',
      apiKey: 'xkeysib-test',
      from: { email: 'sender@example.com', name: 'ACME Salary Management' },
    });
  });

  it('needs the key and sender for Brevo', () => {
    expect(() => loadConfig({ ...required, EMAIL_TRANSPORT: 'brevo' })).toThrow(
      /needs BREVO_API_KEY and EMAIL_FROM/,
    );
  });

  it('refuses the console sender in production, since it logs reset links', () => {
    expect(() => loadConfig({ ...required, NODE_ENV: 'production' })).toThrow(
      /use brevo in production/,
    );
  });
});

describe('rates refresh secret', () => {
  it('is read when set and must be long enough', () => {
    const secret = 'a-rates-refresh-secret-of-32-chars!';
    expect(loadConfig({ ...required, RATES_REFRESH_SECRET: secret }).ratesRefreshSecret).toBe(
      secret,
    );
    expect(() => loadConfig({ ...required, RATES_REFRESH_SECRET: 'short' })).toThrow(
      /RATES_REFRESH_SECRET must be at least 32 characters/,
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
