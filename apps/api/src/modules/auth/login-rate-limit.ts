import type { RequestHandler } from 'express';
import { rateLimit, type Options } from 'express-rate-limit';
import { HttpError } from '../../http/errors.ts';

const windowMs = 15 * 60 * 1000;

const handler: Options['handler'] = (_req, _res, next) => {
  next(new HttpError(429, 'Too many sign-in attempts. Try again in 15 minutes.'));
};

/**
 * Limits on sign-in attempts, kept in memory per API instance:
 * - per email, 5 failed attempts in 15 minutes, which protects each account even if the caller's
 *   IP address changes or is spoofed;
 * - per IP address, 20 attempts in 15 minutes, which slows down guessing across many accounts.
 */
export function loginRateLimits(): RequestHandler[] {
  const perIp = rateLimit({
    windowMs,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler,
  });
  const perEmail = rateLimit({
    windowMs,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => `email:${emailFrom(req.body)}`,
    handler,
  });
  return [perIp, perEmail];
}

function emailFrom(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('email' in body)) return '';
  return typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
}
