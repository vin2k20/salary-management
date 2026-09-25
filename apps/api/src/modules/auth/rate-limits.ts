import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { HttpError } from '../../http/errors.ts';

const windowMs = 15 * 60 * 1000;

/** Rejects with a 429 problem that explains when to try again. */
function limiter(options: {
  limit: number;
  message: string;
  key?: (req: Request) => string;
  countFailuresOnly?: boolean;
}): RequestHandler {
  const { key } = options;
  return rateLimit({
    windowMs,
    limit: options.limit,
    skipSuccessfulRequests: options.countFailuresOnly ?? false,
    standardHeaders: key ? false : 'draft-8',
    legacyHeaders: false,
    ...(key ? { keyGenerator: key } : {}),
    handler: (_req, _res, next) => {
      next(new HttpError(429, options.message));
    },
  });
}

function emailFrom(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('email' in body)) return '';
  return typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
}

/**
 * Limits on sign-in attempts, kept in memory per API instance:
 * - per email, 5 failed attempts in 15 minutes, which protects each account even if the caller's
 *   IP address changes or is spoofed;
 * - per IP address, 20 attempts in 15 minutes, which slows down guessing across many accounts.
 */
export function loginRateLimits(): RequestHandler[] {
  const message = 'Too many sign-in attempts. Try again in 15 minutes.';
  return [
    limiter({ limit: 20, message }),
    limiter({
      limit: 5,
      message,
      key: (req) => `login:${emailFrom(req.body)}`,
      countFailuresOnly: true,
    }),
  ];
}

/**
 * Limits on reset emails: 3 per email and 10 per IP address in 15 minutes, so the endpoint cannot
 * be used to flood a mailbox or use up the daily email allowance.
 */
export function forgotPasswordRateLimits(): RequestHandler[] {
  return [
    limiter({ limit: 10, message: 'Too many requests. Try again in 15 minutes.' }),
    limiter({
      limit: 3,
      message: 'Too many requests for this email. Try again in 15 minutes.',
      key: (req) => `forgot:${emailFrom(req.body)}`,
    }),
  ];
}

/** 20 attempts per IP address in 15 minutes to set a password from a link. */
export function setPasswordRateLimits(): RequestHandler[] {
  return [limiter({ limit: 20, message: 'Too many requests. Try again in 15 minutes.' })];
}

/**
 * 30 requests per signed-in user in 15 minutes for import or export (one limit each). Each can
 * read every employee in the user's scope, so the limit keeps one user from tying up the API.
 */
export function fileRateLimit(kind: 'imports' | 'exports'): RequestHandler {
  return limiter({
    limit: 30,
    message: `Too many ${kind}. Try again in 15 minutes.`,
    // Signed in on these routes; the IP address is only a fallback.
    key: (req) => `${kind}:${req.auth?.user.id ?? ipKeyGenerator(req.ip ?? '')}`,
  });
}
