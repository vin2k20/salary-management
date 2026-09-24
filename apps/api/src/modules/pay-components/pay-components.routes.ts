import { payComponentListQuerySchema } from '@salary/shared';
import { Router } from 'express';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import { parseQuery } from '../../http/validation.ts';
import { listPayComponents } from './pay-components.service.ts';

/** The pay component catalogue. Adding and deactivating components come with step 14. */
export function payComponentsRouter({ db }: { db: Database }): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    if (!req.auth) throw new HttpError(401, 'Sign in to continue');
    const { country } = parseQuery(payComponentListQuerySchema, req.query);
    res.json(await listPayComponents(db, req.auth.scope, country));
  });

  return router;
}
