import { SPREADSHEETS, exportQuerySchema } from '@salary/shared';
import { Router } from 'express';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import { parseQuery } from '../../http/validation.ts';
import { writeCsv, writeXlsx } from './exports.service.ts';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Downloads employees and current pay in the columns import reads (D21), following the
 * directory filters and the caller's scope. The file is streamed while rows are read.
 */
export function exportsRouter({ db, clock }: { db: Database; clock: Clock }): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    if (!req.auth) throw new HttpError(401, 'Sign in to continue');
    const { scope } = req.auth;
    const query = parseQuery(exportQuerySchema, req.query);
    const today = clock.now().toISOString().slice(0, 10);
    // Pay data must not be kept by browsers or proxies.
    res.set('Cache-Control', 'no-store');

    if (query.format === 'csv') {
      const { fileName } = SPREADSHEETS[query.dataset];
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.attachment(`acme-${fileName}-${today}.csv`);
      await writeCsv(res, query.dataset, db, scope, query, today);
      return;
    }
    res.set('Content-Type', XLSX_TYPE);
    res.attachment(`acme-salary-data-${today}.xlsx`);
    await writeXlsx(res, db, scope, query, today);
  });

  return router;
}
