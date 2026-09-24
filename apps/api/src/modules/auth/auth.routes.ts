import { randomUUID } from 'node:crypto';
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  setPasswordRequestSchema,
  type CurrentUserResponse,
} from '@salary/shared';
import { Router, type CookieOptions } from 'express';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import type { EmailSender } from '../../email/email-sender.ts';
import { resetPasswordEmail } from '../../email/templates.ts';
import { HttpError } from '../../http/errors.ts';
import { parseBody } from '../../http/validation.ts';
import { issueAuthToken } from './auth-tokens.ts';
import { hashPassword, verifyPassword } from './passwords.ts';
import { forgotPasswordRateLimits, loginRateLimits, setPasswordRateLimits } from './rate-limits.ts';
import { requireAuth } from './require-auth.ts';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from './session.ts';
import { setPasswordWithToken } from './set-password.ts';
import { findUserByEmail, recordLogin, toCurrentUser } from './users.repository.ts';

export interface AuthSettings {
  jwtSecret: string;
  /** Send the cookie over HTTPS only; on in production. */
  secureCookies: boolean;
}

// Checked when the email is unknown, so a failed sign-in takes about the same time either way.
let dummyHash: Promise<string> | undefined;

export interface AuthRouterOptions {
  db: Database;
  clock: Clock;
  auth: AuthSettings;
  emailSender: EmailSender;
  /** Base address of the web app, for links in emails. */
  appUrl: string;
}

export function authRouter({ db, clock, auth, emailSender, appUrl }: AuthRouterOptions): Router {
  const router = Router();
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: auth.secureCookies,
    sameSite: 'lax',
    path: '/',
  };

  router.post('/login', ...loginRateLimits(), async (req, res) => {
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

  router.post('/forgot-password', ...forgotPasswordRateLimits(), async (req, res) => {
    const { email } = parseBody(forgotPasswordRequestSchema, req.body);
    // Answer first, the same way for every email, so neither the answer nor its timing shows
    // whether an account exists. The link is created and sent afterwards.
    res.status(202).end();
    try {
      const user = await findUserByEmail(db, email);
      if (!user?.isActive) return;
      const token = await issueAuthToken(db, { userId: user.id, purpose: 'reset' }, clock);
      const link = new URL(`/set-password?token=${token}`, appUrl).toString();
      await emailSender.send(resetPasswordEmail(user, link));
    } catch (error) {
      req.log.error({ err: error }, 'Password reset email failed');
    }
  });

  router.post('/set-password', ...setPasswordRateLimits(), async (req, res) => {
    const request = parseBody(setPasswordRequestSchema, req.body);
    if (!(await setPasswordWithToken(db, request, clock))) {
      throw new HttpError(400, 'This link is invalid or has expired. Ask for a new one.');
    }
    res.status(204).end();
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
