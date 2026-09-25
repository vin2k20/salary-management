import {
  payComponentListResponseSchema,
  payComponentResponseSchema,
  type CreatePayComponentRequest,
  type UpdatePayComponentRequest,
} from '@salary/shared';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.ts';

/** Every component in the user's scope, and the pay frequencies. */
export function usePayComponentCatalogue() {
  return useQuery({
    queryKey: ['pay-components', 'all'],
    queryFn: ({ signal }) =>
      apiRequest('/api/pay-components', payComponentListResponseSchema, { signal }),
  });
}

export async function createPayComponent(request: CreatePayComponentRequest) {
  const { component } = await apiRequest('/api/pay-components', payComponentResponseSchema, {
    method: 'POST',
    body: request,
  });
  return component;
}

export async function updatePayComponent(id: string, request: UpdatePayComponentRequest) {
  const { component } = await apiRequest(`/api/pay-components/${id}`, payComponentResponseSchema, {
    method: 'PATCH',
    body: request,
  });
  return component;
}

/** Refreshes every component list, including those the pay dialogs use. */
export function componentsChanged(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ['pay-components'] });
}
