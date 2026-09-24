import type { HealthResponse } from '@salary/shared';
import { Router } from 'express';

export function healthRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const body: HealthResponse = { status: 'ok' };
    res.set('Cache-Control', 'no-store').json(body);
  });

  return router;
}
