import { fileURLToPath } from 'node:url';

/** Folder of SQL migrations written by drizzle-kit and applied in order. */
export const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
