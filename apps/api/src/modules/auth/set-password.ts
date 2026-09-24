import { and, eq, sql } from 'drizzle-orm';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { users } from '../../db/schema.ts';
import { recordChange } from '../change-log/change-log.ts';
import { consumeAuthToken } from './auth-tokens.ts';
import { hashPassword } from './passwords.ts';

/**
 * Sets a user's password from a reset or invite link, in one transaction: the token is used up,
 * the password hash replaced, the token version raised so older sessions end, and the change
 * logged without any password data. Returns false when the link is not valid or the user is
 * inactive.
 */
export async function setPasswordWithToken(
  db: Database,
  { token, password }: { token: string; password: string },
  clock: Clock,
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return db.transaction(async (tx) => {
    const used = await consumeAuthToken(tx, token, clock);
    if (!used) return false;

    const [user] = await tx
      .update(users)
      .set({
        passwordHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: clock.now(),
      })
      .where(and(eq(users.id, used.userId), eq(users.isActive, true)))
      .returning({ id: users.id });
    if (!user) return false;

    await recordChange(
      tx,
      {
        entityType: 'user',
        entityId: user.id,
        action: 'updated',
        changes: { password: { old: 'hidden', new: 'changed' } },
        countryCode: null,
        changedBy: user.id,
      },
      clock,
    );
    return true;
  });
}
