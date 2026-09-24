import { randomUUID } from 'node:crypto';
import { loginRequestSchema, type CurrentUserResponse } from '@salary/shared';
import { Router, type CookieOptions } from 'express';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import { parseBody } from '../../http/validation.ts';
import { hashPassword, verifyPassword } from './passwords.ts';
import { requireAuth } from './require-auth.ts';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from './session.ts';
import { findUserByEmail, recordLogin, toCurrentUser } from './users.repository.ts';

export interface AuthSettings {
  jwtSecret: string;
  /** Send the cookie over HTTPS only; on in production. */
  secureCookies: boolean;
}

// Checked when the email is unknown, so a failed sign-in takes about the same time either way.
let dummyHash: Promise<string> | undefined;

export function authRouter({
  db,
  clock,
  auth,
}: {
  db: Database;
  clock: Clock;
  auth: AuthSettings;
}): Router {
  const router = Router();
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: auth.secureCookies,
    sameSite: 'lax',
    path: '/',
  };

  router.post('/login', async (req, res) => {
    const { email, password } = parseBody(loginRequestSchema, req.body);
    const user = await findUserByEmail(db, email);
    dummyHash ??= hashPassword(randomUUID());
    const passwordMatches = await verifyPassword(user?.passwordHash ?? (await dummyHash), password);
    if (!user?.isActive || user.passwordHash === null || !passwordMatches) {
      throw new HttpError(401, 'Email or password is incorrect');
    }

    await recordLogin(db, user.id, clock.now());
    const token = await createSessionToken(
      { userId: user.id, tokenVersion: user.tokenVersion },
      auth.jwtSecret,
      clock,
    );
    const body: CurrentUserResponse = { user: toCurrentUser(user) };
    res
      .cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS * 1000 })
      .json(body);
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions).status(204).end();
  });

  router.get('/me', requireAuth({ db, clock, jwtSecret: auth.jwtSecret }), (req, res) => {
    if (!req.auth) throw new HttpError(401, 'Sign in to continue');
    const body: CurrentUserResponse = { user: req.auth.user };
    res.set('Cache-Control', 'no-store').json(body);
  });

  return router;
}
