import type { Clock } from '../clock.ts';
import { SESSION_COOKIE, createSessionToken } from '../modules/auth/session.ts';
import { TEST_JWT_SECRET, testClock } from './test-app.ts';

/** A Cookie header value for a signed-in user, without going through the login endpoint. */
export async function sessionCookieFor(
  user: { id: string; tokenVersion: number },
  options: { clock?: Clock; secret?: string } = {},
): Promise<string> {
  const token = await createSessionToken(
    { userId: user.id, tokenVersion: user.tokenVersion },
    options.secret ?? TEST_JWT_SECRET,
    options.clock ?? testClock(),
  );
  return `${SESSION_COOKIE}=${token}`;
}
