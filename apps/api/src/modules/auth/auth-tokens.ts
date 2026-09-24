import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { authTokens, type AuthTokenPurpose } from '../../db/schema.ts';

/** How long a link works: 30 minutes to reset a password, 72 hours to accept an invite. */
export const AUTH_TOKEN_LIFETIME_MS: Record<AuthTokenPurpose, number> = {
  reset: 30 * 60 * 1000,
  invite: 72 * 60 * 60 * 1000,
};

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a single-use token for a link and returns it; only its hash is stored. Any older unused
 * token of the same purpose for the user stops working, so only the latest link is valid.
 */
export async function issueAuthToken(
  db: Database,
  { userId, purpose }: { userId: string; purpose: AuthTokenPurpose },
  clock: Clock,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const now = clock.now();
  await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
      ),
    );
  await db.insert(authTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + AUTH_TOKEN_LIFETIME_MS[purpose]),
  });
  return token;
}

/**
 * Marks a token as used and returns its user and purpose, or null if it is unknown, used or
 * expired. One UPDATE does the check and the marking, so a token cannot be used twice even by
 * requests that arrive at the same time.
 */
export async function consumeAuthToken(
  db: Database,
  token: string,
  clock: Clock,
): Promise<{ userId: string; purpose: AuthTokenPurpose } | null> {
  const now = clock.now();
  const [used] = await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now),
      ),
    )
    .returning({ userId: authTokens.userId, purpose: authTokens.purpose });
  return used ?? null;
}
