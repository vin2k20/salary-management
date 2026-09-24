import {
  payChangeRequestSchema,
  type CurrentPayResponse,
  type PayHistoryResponse,
  type RecordPayChangeResponse,
} from '@salary/shared';
import { Router } from 'express';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { parseBody } from '../../http/validation.ts';
import { employeeId, signedIn } from '../employees/employees.routes.ts';
import { currentPay, payHistory, recordPayChange } from './pay.service.ts';

/** An employee's current pay, pay history and pay changes (HLD 5), under /api/employees. */
export function compensationRouter({ db, clock }: { db: Database; clock: Clock }): Router {
  const router = Router();

  router.get('/:id/pay', async (req, res) => {
    const body: CurrentPayResponse = await currentPay(
      db,
      signedIn(req).scope,
      employeeId(req),
      clock,
    );
    res.json(body);
  });

  router.get('/:id/pay-changes', async (req, res) => {
    const body: PayHistoryResponse = {
      items: await payHistory(db, signedIn(req).scope, employeeId(req), clock),
    };
    res.json(body);
  });

  router.post('/:id/pay-changes', async (req, res) => {
    const { user, scope } = signedIn(req);
    const id = employeeId(req);
    const request = parseBody(payChangeRequestSchema, req.body);
    const body: RecordPayChangeResponse = {
      payChange: await recordPayChange(db, scope, id, request, user, clock),
    };
    res.status(201).json(body);
  });

  return router;
}
