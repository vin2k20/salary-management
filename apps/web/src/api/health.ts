import { healthResponseSchema, type HealthResponse } from '@salary/shared';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Health check failed with status ${String(response.status)}`);
  }
  return healthResponseSchema.parse(await response.json());
}
