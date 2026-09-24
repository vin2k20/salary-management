import { ApiError } from './client.ts';

/** A message for a failed request: the API's own message, or a general one. */
export function errorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}
