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
    // A copy for each call: the page makes more than one request, and a body can be read once.
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response.clone()),
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

describe('HomePage exchange rates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the latest rates and their date', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) =>
        Promise.resolve(
          input === '/api/fx-rates/latest'
            ? Response.json({
                rateDate: '2026-09-24',
                rates: { USD: '1', CAD: '1.4117', AUD: '1.4232', INR: '95.96' },
                stale: false,
              })
            : Response.json({ status: 'ok', database: 'ok' }),
        ),
      ),
    );

    renderHomePage();

    expect(await screen.findByText('1 USD = 95.96 INR')).toBeInTheDocument();
    expect(screen.getByText('1 USD = 1.4117 CAD')).toBeInTheDocument();
    expect(screen.getByText('Rates of 24 Sep 2026')).toBeInTheDocument();
    expect(screen.queryByText(/more than 3 days old/)).not.toBeInTheDocument();
  });

  it('warns when the rates are more than three days old', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) =>
        Promise.resolve(
          input === '/api/fx-rates/latest'
            ? Response.json({
                rateDate: '2026-09-01',
                rates: { USD: '1', INR: '88.2' },
                stale: true,
              })
            : Response.json({ status: 'ok', database: 'ok' }),
        ),
      ),
    );

    renderHomePage();

    expect(
      await screen.findByText(
        'These rates are more than 3 days old, so amounts in US dollars may be out of date.',
      ),
    ).toBeInTheDocument();
  });
});
