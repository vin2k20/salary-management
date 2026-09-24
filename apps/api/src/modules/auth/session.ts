import { SignJWT, jwtVerify } from 'jose';
import type { Clock } from '../../clock.ts';

export const SESSION_COOKIE = 'session';

/** Sessions last eight hours. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface SessionClaims {
  userId: string;
  tokenVersion: number;
}

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

/** Signs a session token (HS256) carrying the user ID and token version. */
export function createSessionToken(claims: SessionClaims, secret: string, clock: Clock) {
  const issuedAt = Math.floor(clock.now().getTime() / 1000);
  return new SignJWT({ ver: claims.tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(key(secret));
}

/** Checks the signature and expiry of a session token. Returns null for any invalid token. */
export async function readSessionToken(
  token: string,
  secret: string,
  clock: Clock,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ['HS256'],
      currentDate: clock.now(),
    });
    if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number') return null;
    return { userId: payload.sub, tokenVersion: payload.ver };
  } catch {
    return null;
  }
}
