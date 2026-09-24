import { vi } from 'vitest';

type Handler = (request: { body: unknown }) => Response | Promise<Response>;

/**
 * Replaces fetch with handlers keyed by "METHOD /path", matched without the query string. Unknown
 * requests get a 404, and every call is recorded with its query so tests can check what was sent.
 */
export function mockApi(handlers: Record<string, Handler>) {
  const calls: { method: string; path: string; query: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      'http://localhost',
    );
    const method = (init?.method ?? 'GET').toUpperCase();
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: url.pathname, query: url.search, body });
    const handler = handlers[`${method} ${url.pathname}`];
    return handler ? handler({ body }) : Response.json({ status: 404 }, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls };
}

export function problem(status: number, detail: string) {
  return Response.json(
    { type: 'about:blank', title: 'Error', status, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export const globalHrUser = {
  id: '6f1c2a4e-8b4d-4c5e-9f3a-2b7d1e0c9a11',
  email: 'global.hr@acme.example.com',
  name: 'Global HR',
  role: 'global_hr',
  countryCode: null,
} as const;

export const indiaHrUser = {
  id: '7a2d3b5f-9c5e-4d6f-8a4b-3c8e2f1d0b22',
  email: 'hr.in@acme.example.com',
  name: 'India HR',
  role: 'country_hr',
  countryCode: 'IN',
} as const;

export const healthy = () => Response.json({ status: 'ok', database: 'ok' });
