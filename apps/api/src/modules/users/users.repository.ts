import type { CountryCode, UserSummary } from '@salary/shared';
import { count, eq } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { users } from '../../db/schema.ts';

export type UserRecord = typeof users.$inferSelect;

export function toUserSummary(user: UserRecord): UserSummary {
  let status: UserSummary['status'] = 'active';
  if (!user.isActive) status = 'inactive';
  else if (user.passwordHash === null) status = 'invited';
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    countryCode: user.countryCode as CountryCode | null,
    status,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function listUsers(
  db: Database,
  { page, pageSize }: { page: number; pageSize: number },
) {
  const rows = await db
    .select()
    .from(users)
    .orderBy(users.name, users.email)
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [total] = await db.select({ value: count() }).from(users);
  return { rows, total: total?.value ?? 0 };
}

export async function findUser(db: Database, id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}
