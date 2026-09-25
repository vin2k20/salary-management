import {
  createPayComponentRequestSchema,
  payComponentListQuerySchema,
  updatePayComponentRequestSchema,
  type PayComponentResponse,
} from '@salary/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import { parseBody, parseQuery } from '../../http/validation.ts';
import {
  createPayComponent,
  listPayComponents,
  updatePayComponent,
} from './pay-components.service.ts';

const idSchema = z.uuid();

function componentId(req: Request): string {
  const result = idSchema.safeParse(req.params.id);
  if (!result.success) throw new HttpError(404, 'Pay component not found');
  return result.data;
}

function signedIn(req: Request) {
  if (!req.auth) throw new HttpError(401, 'Sign in to continue');
  return req.auth;
}

/** The pay component catalogue: list, add, rename, deactivate and reactivate (HLD 3.3). */
export function payComponentsRouter({ db, clock }: { db: Database; clock: Clock }): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { country } = parseQuery(payComponentListQuerySchema, req.query);
    res.json(await listPayComponents(db, signedIn(req).scope, country));
  });

  router.post('/', async (req, res) => {
    const { user, scope } = signedIn(req);
    const input = parseBody(createPayComponentRequestSchema, req.body);
    const body: PayComponentResponse = {
      component: await createPayComponent(db, scope, input, user, clock),
    };
    res.status(201).json(body);
  });

  router.patch('/:id', async (req, res) => {
    const { user, scope } = signedIn(req);
    const id = componentId(req);
    const update = parseBody(updatePayComponentRequestSchema, req.body);
    const body: PayComponentResponse = {
      component: await updatePayComponent(db, scope, id, update, user, clock),
    };
    res.json(body);
  });

  return router;
}
