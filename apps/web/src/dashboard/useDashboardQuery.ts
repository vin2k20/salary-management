import { insightsQuerySchema, type InsightsQuery } from '@salary/shared';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useDisplayCurrency } from '../currency/useDisplayCurrency.ts';

/** URL parameters the dashboard owns; `currency` belongs to the header toggle. */
const DASHBOARD_KEYS = ['country', 'measure', 'includeInactive'] as const;

export type DashboardKey = (typeof DASHBOARD_KEYS)[number];

const defaults = insightsQuerySchema.parse({});

/**
 * The dashboard filters, read from the URL with the schema the API uses, so a shared link shows
 * the same view. Default values are left out of the URL.
 */
export function useDashboardQuery() {
  const [params, setParams] = useSearchParams();
  const [currency] = useDisplayCurrency();

  const raw = Object.fromEntries(DASHBOARD_KEYS.map((key) => [key, params.get(key) ?? undefined]));
  const parsed = insightsQuerySchema.safeParse({ ...raw, currency });
  const query: InsightsQuery = parsed.success
    ? parsed.data
    : insightsQuerySchema.parse({ currency });

  const update = useCallback(
    (patch: Partial<Record<DashboardKey, string | boolean>>) => {
      setParams((next) => {
        // Object.entries widens the keys to string; they are the keys of `patch`.
        for (const [key, value] of Object.entries(patch) as [DashboardKey, string | boolean][]) {
          const text = value === false ? '' : String(value);
          if (text === '' || text === String(defaults[key] ?? '')) next.delete(key);
          else next.set(key, text);
        }
        return next;
      });
    },
    [setParams],
  );

  return { query, update };
}
