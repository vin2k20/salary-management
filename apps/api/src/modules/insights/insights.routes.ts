import { insightsQuerySchema } from '@salary/shared';
import { Router, type Request } from 'express';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import { parseQuery } from '../../http/validation.ts';
import { insightsSummary, payRanges } from './insights.service.ts';

function signedIn(req: Request) {
  if (!req.auth) throw new HttpError(401, 'Sign in to continue');
  return req.auth;
}

/** The dashboard: statistics over current pay within the caller's scope (HLD 5). */
export function insightsRouter({ db, clock }: { db: Database; clock: Clock }): Router {
  const router = Router();

  router.get('/summary', async (req, res) => {
    const query = parseQuery(insightsQuerySchema, req.query);
    res.json(await insightsSummary(db, signedIn(req).scope, query, clock));
  });

  router.get('/pay-range-by-country', async (req, res) => {
    const query = parseQuery(insightsQuerySchema, req.query);
    res.json(await payRanges(db, signedIn(req).scope, query, clock));
  });

  return router;
}
