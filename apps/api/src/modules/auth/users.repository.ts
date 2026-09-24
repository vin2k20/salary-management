import type { CountryCode, CurrentUser } from '@salary/shared';
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { users } from '../../db/schema.ts';

export type UserRecord = typeof users.$inferSelect;

export async function findUserByEmail(db: Database, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return user;
}

export async function findUserById(db: Database, id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function recordLogin(db: Database, id: string, at: Date) {
  await db.update(users).set({ lastLoginAt: at }).where(eq(users.id, id));
}

/** The fields of a user that the client may see. */
export function toCurrentUser(user: UserRecord): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    countryCode: user.countryCode as CountryCode | null,
  };
}
