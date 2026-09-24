import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Database } from '../db/client.ts';
import { migrationsFolder } from '../db/migrations.ts';
import * as schema from '../db/schema.ts';

export interface TestDatabase {
  db: Database;
  client: PGlite;
  close: () => Promise<void>;
}

/** A fresh PostgreSQL database in memory with every migration applied. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = await PGlite.create({ extensions: { pg_trgm } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db, client, close: () => client.close() };
}
