import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Every run migrates this database and replaces its data, so it must be a throwaway PostgreSQL
// database on this machine (or the CI service container), never a shared one.
const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Set E2E_DATABASE_URL to a local PostgreSQL database the smoke test may reset');
}
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('E2E_DATABASE_URL must point at a database on localhost');
}

// Made up for each run, and passed to the test workers through the environment.
process.env.E2E_HR_PASSWORD ??= randomBytes(18).toString('base64url');
process.env.E2E_JWT_SECRET ??= randomBytes(48).toString('base64url');

const apiPort = 3100;
const webPort = 4173;
const webUrl = `http://localhost:${String(webPort)}`;

export default defineConfig({
  testDir: './tests',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: webUrl,
    locale: 'en-US',
    trace: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'API',
      // A small, fresh data set for every run, then the API.
      command:
        'node src/scripts/migrate.ts && node src/scripts/seed.ts --reset --count 200 && node src/server.ts',
      cwd: fileURLToPath(new URL('../apps/api', import.meta.url)),
      url: `http://localhost:${String(apiPort)}/api/health`,
      env: {
        DATABASE_URL: databaseUrl,
        JWT_SECRET: process.env.E2E_JWT_SECRET,
        SEED_HR_PASSWORD: process.env.E2E_HR_PASSWORD,
        PORT: String(apiPort),
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
        APP_URL: webUrl,
        EMAIL_TRANSPORT: 'console',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      name: 'Web',
      // The production build, served with the same-origin /api proxy.
      command: `npm run build && npm run preview -- --port ${String(webPort)} --strictPort`,
      cwd: fileURLToPath(new URL('../apps/web', import.meta.url)),
      url: webUrl,
      env: { API_PROXY_TARGET: `http://localhost:${String(apiPort)}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
