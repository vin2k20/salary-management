import {
  employeeListResponseSchema,
  referenceDataSchema,
  type EmployeeListQuery,
} from '@salary/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client.ts';

/** Query string for the API: filters when set, sort when not the default, paging and currency. */
export function employeeListSearch(query: EmployeeListQuery): string {
  const params = new URLSearchParams();
  for (const key of [
    'search',
    'country',
    'region',
    'department',
    'jobTitle',
    'employmentType',
  ] as const) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  if (query.includeInactive) params.set('includeInactive', 'true');
  if (query.sort !== 'name') params.set('sort', query.sort);
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  params.set('currency', query.currency);
  return params.toString();
}

export function useEmployeeList(query: EmployeeListQuery) {
  return useQuery({
    queryKey: ['employees', query],
    queryFn: ({ signal }) =>
      apiRequest(`/api/employees?${employeeListSearch(query)}`, employeeListResponseSchema, {
        signal,
      }),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function useReferenceData() {
  return useQuery({
    queryKey: ['reference'],
    queryFn: ({ signal }) => apiRequest('/api/reference', referenceDataSchema, { signal }),
    staleTime: 5 * 60 * 1000,
  });
}
