import { fxRatesResponseSchema, fxRefreshResponseSchema } from '@salary/shared';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client.ts';
import { formatDate } from '../lib/format.ts';

export const fxRatesQueryKey = ['fx-rates', 'latest'] as const;

/** The latest exchange rates, shared by every screen that converts amounts. */
export function useFxRates() {
  return useQuery({
    queryKey: fxRatesQueryKey,
    queryFn: ({ signal }) => apiRequest('/api/fx-rates/latest', fxRatesResponseSchema, { signal }),
    staleTime: 5 * 60 * 1000,
  });
}

/** "2026-09-24" as "24 Sep 2026". */
export const formatRateDate = formatDate;

/** Asks the API to fetch the latest rates now (global HR users only). */
export function refreshRates() {
  return apiRequest('/api/fx-rates/refresh', fxRefreshResponseSchema, { method: 'POST' });
}
