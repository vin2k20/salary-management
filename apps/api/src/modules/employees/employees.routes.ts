import { employeeListQuerySchema } from '@salary/shared';
import { Router } from 'express';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import { parseQuery } from '../../http/validation.ts';
import { employeeDirectory } from './employees.service.ts';

export function employeesRouter({ db, clock }: { db: Database; clock: Clock }): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    if (!req.auth) throw new HttpError(401, 'Sign in to continue');
    const query = parseQuery(employeeListQuerySchema, req.query);
    res.json(await employeeDirectory(db, req.auth.scope, query, clock));
  });

  return router;
}
