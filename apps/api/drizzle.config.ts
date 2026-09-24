import { defineConfig } from 'drizzle-kit';

// Used by `npm run db:generate` to write SQL migrations from the schema. It needs no database.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
