import {
  createUserResponseSchema,
  userListResponseSchema,
  userSummarySchema,
  type CreateUserRequest,
  type UpdateUserRequest,
} from '@salary/shared';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest, apiSend } from '../api/client.ts';

export const usersQueryKey = ['users'] as const;

export function useUsers() {
  return useQuery({
    queryKey: usersQueryKey,
    queryFn: ({ signal }) =>
      apiRequest('/api/users?pageSize=100', userListResponseSchema, { signal }),
  });
}

export function createUser(request: CreateUserRequest) {
  return apiRequest('/api/users', createUserResponseSchema, { method: 'POST', body: request });
}

export async function updateUser(id: string, request: UpdateUserRequest) {
  const { user } = await apiRequest(`/api/users/${id}`, z.object({ user: userSummarySchema }), {
    method: 'PATCH',
    body: request,
  });
  return user;
}

export function resendInvite(id: string) {
  return apiSend(`/api/users/${id}/invite`, { method: 'POST' });
}
