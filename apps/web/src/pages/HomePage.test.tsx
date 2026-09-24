import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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

describe('HomePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows that the API is available when the health check returns ok', async () => {
    const fetchMock = stubFetch(Response.json({ status: 'ok' }));

    renderHomePage();

    expect(screen.getByRole('status')).toHaveTextContent('Checking');
    expect(await screen.findByText('Available')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything());
  });

  it('shows that the API is unavailable when the health check fails', async () => {
    stubFetch(new Response(null, { status: 503 }));

    renderHomePage();

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
  });

  it('shows that the API is unavailable when the API cannot be reached', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    renderHomePage();

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
  });
});
