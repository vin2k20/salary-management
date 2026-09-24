import {
  changeLogResponseSchema,
  currentPayResponseSchema,
  employeeDetailResponseSchema,
  employeeListResponseSchema,
  employeeResponseSchema,
  payComponentListResponseSchema,
  payHistoryResponseSchema,
  recordPayChangeResponseSchema,
  referenceDataSchema,
  type CountryCode,
  type CreateEmployeeRequest,
  type Employee,
  type EmployeeDetailResponse,
  type EmployeeListQuery,
  type PayChangeRequestBody,
  type TransferRequest,
  type UpdateEmployeeRequest,
} from '@salary/shared';
import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
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

export function employeeQueryKey(id: string) {
  return ['employee', id] as const;
}

/** An employee's details and today's pay totals. */
export function useEmployee(id: string) {
  return useQuery({
    queryKey: employeeQueryKey(id),
    queryFn: ({ signal }) =>
      apiRequest(`/api/employees/${id}`, employeeDetailResponseSchema, { signal }),
  });
}

export function useEmployeeChangeLog(id: string) {
  return useQuery({
    queryKey: [...employeeQueryKey(id), 'change-log'],
    queryFn: ({ signal }) =>
      apiRequest(`/api/employees/${id}/change-log`, changeLogResponseSchema, { signal }),
  });
}

export async function createEmployee(request: CreateEmployeeRequest) {
  const { employee } = await apiRequest('/api/employees', employeeResponseSchema, {
    method: 'POST',
    body: request,
  });
  return employee;
}

export async function updateEmployee(id: string, request: UpdateEmployeeRequest) {
  const { employee } = await apiRequest(`/api/employees/${id}`, employeeResponseSchema, {
    method: 'PATCH',
    body: request,
  });
  return employee;
}

/**
 * After an employee is saved: keep the saved record, and refresh its change log, the directory
 * and the filter choices, which may now include a new job title or department.
 */
export async function employeeSaved(queryClient: QueryClient, employee: Employee) {
  queryClient.setQueryData(employeeQueryKey(employee.id), (old?: EmployeeDetailResponse) =>
    old ? { ...old, employee } : old,
  );
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [...employeeQueryKey(employee.id), 'change-log'] }),
    queryClient.invalidateQueries({ queryKey: ['employees'] }),
    queryClient.invalidateQueries({ queryKey: ['reference'] }),
  ]);
}

/** Components usable in a country, and the pay frequencies. */
export function usePayComponents(country: CountryCode | undefined) {
  return useQuery({
    queryKey: ['pay-components', country],
    queryFn: ({ signal }) =>
      apiRequest(`/api/pay-components?country=${country ?? ''}`, payComponentListResponseSchema, {
        signal,
      }),
    enabled: country !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurrentPay(id: string) {
  return useQuery({
    queryKey: [...employeeQueryKey(id), 'pay'],
    queryFn: ({ signal }) =>
      apiRequest(`/api/employees/${id}/pay`, currentPayResponseSchema, { signal }),
  });
}

export function usePayHistory(id: string) {
  return useQuery({
    queryKey: [...employeeQueryKey(id), 'pay-changes'],
    queryFn: ({ signal }) =>
      apiRequest(`/api/employees/${id}/pay-changes`, payHistoryResponseSchema, { signal }),
  });
}

export async function recordPayChange(id: string, request: PayChangeRequestBody) {
  const { payChange } = await apiRequest(
    `/api/employees/${id}/pay-changes`,
    recordPayChangeResponseSchema,
    { method: 'POST', body: request },
  );
  return payChange;
}

export async function transferEmployee(id: string, request: TransferRequest) {
  const { employee } = await apiRequest(`/api/employees/${id}/transfer`, employeeResponseSchema, {
    method: 'POST',
    body: request,
  });
  return employee;
}

/**
 * After pay changes or a move: refresh everything about the employee (details, totals, pay,
 * history and change log) and the directory, whose totals and countries may change.
 */
export async function payChanged(queryClient: QueryClient, id: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: employeeQueryKey(id) }),
    queryClient.invalidateQueries({ queryKey: ['employees'] }),
  ]);
}
