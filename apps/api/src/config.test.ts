import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('uses defaults when variables are not set', () => {
    expect(loadConfig({})).toEqual({ port: 3000, logLevel: 'info' });
  });

  it('reads the port and log level', () => {
    expect(loadConfig({ PORT: '4000', LOG_LEVEL: 'debug' })).toEqual({
      port: 4000,
      logLevel: 'debug',
    });
  });

  it('rejects an invalid port or log level', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });
});
