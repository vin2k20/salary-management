import { currentUserResponseSchema, type CurrentUser, type LoginRequest } from '@salary/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest, apiSend } from '../api/client.ts';

export const currentUserQueryKey = ['current-user'] as const;

/** The signed-in user, or null when there is no valid session. */
async function fetchCurrentUser(signal?: AbortSignal): Promise<CurrentUser | null> {
  try {
    const { user } = await apiRequest('/api/auth/me', currentUserResponseSchema, { signal });
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Loads the current user once on start; login and logout update it directly. */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: ({ signal }) => fetchCurrentUser(signal),
    retry: false,
    staleTime: Infinity,
  });
}

export async function login(request: LoginRequest): Promise<CurrentUser> {
  const { user } = await apiRequest('/api/auth/login', currentUserResponseSchema, {
    method: 'POST',
    body: request,
  });
  return user;
}

export function logout(): Promise<void> {
  return apiSend('/api/auth/logout', { method: 'POST' });
}
