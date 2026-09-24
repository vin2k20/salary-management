import type { Role } from '@salary/shared';
import type { RequestHandler } from 'express';
import { HttpError } from '../../http/errors.ts';

/** Rejects signed-in users without the role with 403. Use after requireAuth. */
export function requireRole(role: Role, message: string): RequestHandler {
  return (req, _res, next) => {
    if (req.auth?.user.role !== role) {
      throw new HttpError(403, message);
    }
    next();
  };
}
