import type { HealthResponse } from '@salary/shared';
import { sql } from 'drizzle-orm';
import { Router } from 'express';
import type { Database } from '../../db/client.ts';

export function healthRouter(db: Database): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    let body: HealthResponse = { status: 'ok', database: 'ok' };
    try {
      await db.execute(sql`select 1`);
    } catch (error) {
      req.log.warn({ err: error }, 'Database health check failed');
      body = { status: 'degraded', database: 'unavailable' };
    }
    res
      .status(body.status === 'ok' ? 200 : 503)
      .set('Cache-Control', 'no-store')
      .json(body);
  });

  return router;
}
