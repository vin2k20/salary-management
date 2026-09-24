import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each test file starts its own in-memory PostgreSQL (PGlite) and applies every migration,
    // which can take a few seconds when many files start at once or on a slow CI machine.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
