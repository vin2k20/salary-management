import type { z } from 'zod';

/** An error answer from the API, with the problem details message safe to show to users. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function send(path: string, { method = 'GET', body, signal }: RequestOptions) {
  const response = await fetch(path, {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(response.status, await problemDetail(response));
  }
  return response;
}

/** Calls the API and checks the JSON response against a shared schema. */
export async function apiRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  options: RequestOptions = {},
): Promise<z.output<T>> {
  const response = await send(path, options);
  return schema.parse(await response.json());
}

/** Calls the API when no response body is expected. */
export async function apiSend(path: string, options: RequestOptions = {}): Promise<void> {
  await send(path, options);
}

async function problemDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'detail' in body) {
      if (typeof body.detail === 'string') return body.detail;
    }
  } catch {
    // Not JSON: fall through to the general message.
  }
  return 'Something went wrong. Try again.';
}
