import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage.tsx';

function renderHomePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function expectStatus(api: string, database: string) {
  const status = screen.getByRole('status');
  await waitFor(() => {
    expect(status).toHaveTextContent(`API: ${api}`);
  });
  expect(status).toHaveTextContent(`Database: ${database}`);
}

describe('HomePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the API and the database as available when the health check returns ok', async () => {
    const fetchMock = stubFetch(Response.json({ status: 'ok', database: 'ok' }));

    renderHomePage();

    expect(screen.getByRole('status')).toHaveTextContent('API: Checking...');
    await expectStatus('Available', 'Available');
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything());
  });

  it('shows the database as unavailable when the API reports it', async () => {
    stubFetch(Response.json({ status: 'degraded', database: 'unavailable' }, { status: 503 }));

    renderHomePage();

    await expectStatus('Available', 'Unavailable');
  });

  it('shows the API as unavailable when it returns an unexpected error', async () => {
    stubFetch(new Response(null, { status: 500 }));

    renderHomePage();

    await expectStatus('Unavailable', 'Unknown');
  });

  it('shows the API as unavailable and the database as unknown when the API cannot be reached', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    renderHomePage();

    await expectStatus('Unavailable', 'Unknown');
  });
});
