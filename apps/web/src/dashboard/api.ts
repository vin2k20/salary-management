import {
  costByDepartmentResponseSchema,
  insightsSummarySchema,
  outliersResponseSchema,
  payByJobTitleResponseSchema,
  payRangeByCountryResponseSchema,
  type CountryCode,
  type InsightsQuery,
  type OutlierDirection,
} from '@salary/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import { apiRequest } from '../api/client.ts';

/** Query string for the insight endpoints: country when chosen, then the measure and currency. */
export function insightsSearch(
  query: InsightsQuery,
  extra: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  if (query.country) params.set('country', query.country);
  params.set('measure', query.measure);
  params.set('currency', query.currency);
  if (query.includeInactive) params.set('includeInactive', 'true');
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) params.set(key, value);
  }
  return params.toString();
}

/** One dashboard section's data; the previous answer stays on screen while filters change. */
function useInsight<T extends z.ZodType>(
  path: string,
  schema: T,
  query: InsightsQuery,
  extra: Record<string, string | undefined> = {},
) {
  const search = insightsSearch(query, extra);
  return useQuery({
    queryKey: ['insights', path, search],
    queryFn: ({ signal }) => apiRequest(`/api/insights/${path}?${search}`, schema, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useInsightsSummary(query: InsightsQuery) {
  return useInsight('summary', insightsSummarySchema, query);
}

export function usePayRanges(query: InsightsQuery) {
  return useInsight('pay-range-by-country', payRangeByCountryResponseSchema, query);
}

export function useDepartmentCosts(query: InsightsQuery) {
  return useInsight('cost-by-department', costByDepartmentResponseSchema, query);
}

/** Job titles in one country; a country HR user's own country when `country` is not set. */
export function useJobTitlePay(query: InsightsQuery, country: CountryCode | undefined) {
  return useInsight('by-job-title', payByJobTitleResponseSchema, { ...query, country });
}

export function useOutliers(
  query: InsightsQuery,
  { direction, page }: { direction: OutlierDirection | undefined; page: number },
) {
  return useInsight('outliers', outliersResponseSchema, query, {
    direction,
    page: String(page),
  });
}
