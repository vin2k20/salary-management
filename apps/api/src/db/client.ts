import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

/** Database handle shared by the API and tests: node-postgres in the app, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDatabase(databaseUrl: string): {
  db: NodePgDatabase<typeof schema>;
  close: () => Promise<void>;
} {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 5,
    connectionTimeoutMillis: 10_000,
  });
  const db = drizzle(pool, { schema });
  return { db, close: () => pool.end() };
}
