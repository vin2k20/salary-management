import type { CountryCode, Role } from '@salary/shared';
import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { users } from '../db/schema.ts';
import { hashPassword } from '../modules/auth/passwords.ts';

export interface SeedUser {
  email: string;
  name: string;
  role: Role;
  countryCode: CountryCode | null;
}

/** Demo HR users: one global HR user and one HR user per country. */
export const SEED_USERS: SeedUser[] = [
  { email: 'global.hr@acme.example.com', name: 'Global HR', role: 'global_hr', countryCode: null },
  { email: 'hr.in@acme.example.com', name: 'India HR', role: 'country_hr', countryCode: 'IN' },
  { email: 'hr.us@acme.example.com', name: 'USA HR', role: 'country_hr', countryCode: 'US' },
  { email: 'hr.ca@acme.example.com', name: 'Canada HR', role: 'country_hr', countryCode: 'CA' },
  { email: 'hr.au@acme.example.com', name: 'Australia HR', role: 'country_hr', countryCode: 'AU' },
];

export const MIN_SEED_PASSWORD_LENGTH = 12;

/**
 * Creates the demo HR users, or updates them if they exist: same password for all, active, and
 * with a raised token version so any older sessions end. The password comes from an environment
 * variable and is never stored in the repository.
 */
export async function seedUsers(db: Database, password: string): Promise<number> {
  if (password.length < MIN_SEED_PASSWORD_LENGTH) {
    throw new Error(
      `The HR user password must be at least ${String(MIN_SEED_PASSWORD_LENGTH)} characters`,
    );
  }
  const passwordHash = await hashPassword(password);
  await db
    .insert(users)
    .values(SEED_USERS.map((user) => ({ ...user, passwordHash })))
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: sql`excluded.name`,
        role: sql`excluded.role`,
        countryCode: sql`excluded.country_code`,
        passwordHash: sql`excluded.password_hash`,
        isActive: true,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: sql`now()`,
      },
    });
  return SEED_USERS.length;
}
