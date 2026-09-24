import { healthResponseSchema, type HealthResponse } from '@salary/shared';

/**
 * Reads the API health. A 503 still carries a health body (database unavailable); any other error
 * status means the API itself is not healthy.
 */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', { signal, headers: { Accept: 'application/json' } });
  if (!response.ok && response.status !== 503) {
    throw new Error(`Health check failed with status ${String(response.status)}`);
  }
  return healthResponseSchema.parse(await response.json());
}
