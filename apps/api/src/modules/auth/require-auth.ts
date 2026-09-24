import type { CurrentUser } from '@salary/shared';
import type { RequestHandler } from 'express';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import { SESSION_COOKIE, readSessionToken } from './session.ts';
import { findUserById, toCurrentUser } from './users.repository.ts';

export interface AuthContext {
  user: CurrentUser;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireAuth for signed-in requests. */
    auth?: AuthContext;
  }
}

export interface RequireAuthOptions {
  db: Database;
  clock: Clock;
  jwtSecret: string;
}

/**
 * Rejects the request with 401 unless it carries a valid, unexpired session for an active user
 * whose token version still matches. The user is read on every request, so deactivation, a
 * password reset or a role change applies straight away.
 */
export function requireAuth({ db, clock, jwtSecret }: RequireAuthOptions): RequestHandler {
  return async (req, _res, next) => {
    // cookie-parser types the cookies as any; they are strings keyed by name.
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[SESSION_COOKIE];
    const claims =
      typeof token === 'string' ? await readSessionToken(token, jwtSecret, clock) : null;
    const user = claims ? await findUserById(db, claims.userId) : undefined;
    if (!user?.isActive || user.tokenVersion !== claims?.tokenVersion) {
      throw new HttpError(401, 'Sign in to continue');
    }
    req.auth = { user: toCurrentUser(user) };
    next();
  };
}
