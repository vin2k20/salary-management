import { createHash, timingSafeEqual } from 'node:crypto';
import type { FxRatesResponse, FxRefreshResponse } from '@salary/shared';
import { Router, type Request } from 'express';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { HttpError } from '../../http/errors.ts';
import { requireRole } from '../auth/require-role.ts';
import type { RateProvider } from './frankfurter-client.ts';
import { latestRates, refreshRates } from './fx-rates.service.ts';

export interface FxRatesRouterOptions {
  db: Database;
  clock: Clock;
  rateProvider: RateProvider;
}

/** Refreshes rates, turning a provider failure into a logged 502. */
async function refresh(req: Request, { db, clock, rateProvider }: FxRatesRouterOptions) {
  try {
    return await refreshRates(db, rateProvider, clock);
  } catch (error) {
    req.log.error({ err: error }, 'Exchange rate refresh failed');
    throw new HttpError(502, 'The exchange rate service is not available. Try again later.');
  }
}

/** Exchange rates for signed-in users; refreshing by hand is for global HR users. */
export function fxRatesRouter(options: FxRatesRouterOptions): Router {
  const router = Router();

  router.get('/latest', async (_req, res) => {
    const body: FxRatesResponse = await latestRates(options.db, options.clock);
    res.set('Cache-Control', 'no-store').json(body);
  });

  router.post(
    '/refresh',
    requireRole('global_hr', 'Only global HR users can refresh exchange rates'),
    async (req, res) => {
      const { stored } = await refresh(req, options);
      const body: FxRefreshResponse = {
        ...(await latestRates(options.db, options.clock)),
        stored,
      };
      res.json(body);
    },
  );

  return router;
}

/** Compares secrets in constant time, so the answer time does not reveal matching characters. */
function secretsMatch(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/**
 * The refresh called by the daily GitHub Actions job. It needs no session but a shared secret in
 * `Authorization: Bearer <secret>`; without a configured secret it is switched off.
 */
export function internalFxRatesRouter(
  options: FxRatesRouterOptions & { secret: string | null },
): Router {
  const router = Router();

  router.post('/refresh', async (req, res) => {
    if (options.secret === null) {
      throw new HttpError(503, 'The scheduled refresh is not set up');
    }
    const header = req.get('Authorization') ?? '';
    const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!given || !secretsMatch(given, options.secret)) {
      throw new HttpError(401, 'A valid refresh secret is required');
    }
    const result = await refresh(req, options);
    req.log.info(result, 'Exchange rates refreshed');
    res.json(result);
  });

  return router;
}
