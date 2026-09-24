import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { users } from '../db/schema.ts';
import { verifyPassword } from '../modules/auth/passwords.ts';
import { createTestDatabase, type TestDatabase } from '../test/test-database.ts';
import { SEED_USERS, seedUsers } from './seed-users.ts';

describe('seedUsers', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  async function allUsers() {
    return database.db.select().from(users).orderBy(users.email);
  }

  it('creates one global HR user and one HR user per country with the given password', async () => {
    await seedUsers(database.db, 'first demo password');

    const rows = await allUsers();
    expect(rows.map((user) => [user.email, user.role, user.countryCode])).toEqual([
      ['global.hr@acme.example.com', 'global_hr', null],
      ['hr.au@acme.example.com', 'country_hr', 'AU'],
      ['hr.ca@acme.example.com', 'country_hr', 'CA'],
      ['hr.in@acme.example.com', 'country_hr', 'IN'],
      ['hr.us@acme.example.com', 'country_hr', 'US'],
    ]);
    expect(SEED_USERS).toHaveLength(5);
    for (const user of rows) {
      await expect(verifyPassword(user.passwordHash, 'first demo password')).resolves.toBe(true);
    }
  });

  it('updates the existing users on a second run and signs out their sessions', async () => {
    const [before] = await database.db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.email, 'hr.us@acme.example.com'))
      .returning();

    await seedUsers(database.db, 'second demo password');

    const rows = await allUsers();
    const us = rows.find((user) => user.email === 'hr.us@acme.example.com');
    expect(rows).toHaveLength(5);
    expect(us?.isActive).toBe(true);
    expect(us?.tokenVersion).toBe((before?.tokenVersion ?? 0) + 1);
    await expect(verifyPassword(us?.passwordHash ?? null, 'second demo password')).resolves.toBe(
      true,
    );
    await expect(verifyPassword(us?.passwordHash ?? null, 'first demo password')).resolves.toBe(
      false,
    );
  });

  it('rejects a password shorter than twelve characters', async () => {
    await expect(seedUsers(database.db, 'short')).rejects.toThrow(/at least 12 characters/);
  });
});
