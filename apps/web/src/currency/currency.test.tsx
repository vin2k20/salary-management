import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../test/mock-api.ts';
import { CurrencyToggle } from './CurrencyToggle.tsx';
import { Money } from './Money.tsx';
import { RateDate } from './RateDate.tsx';

const latest = () =>
  Response.json({
    rateDate: '2026-09-24',
    rates: { USD: '1', CAD: '1.4117', AUD: '1.4232', INR: '95.96' },
    stale: false,
  });

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <CurrencyToggle />
            <p data-testid="salary">
              <Money amountMinor={8_000_000} currency="INR" />
            </p>
            <RateDate />
          </>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}

describe('currency toggle and amounts', () => {
  beforeEach(() => {
    localStorage.clear();
    mockApi({ 'GET /api/fx-rates/latest': latest });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows amounts in local currency by default, without a rate date', () => {
    renderAt('/');

    expect(screen.getByTestId('salary')).toHaveTextContent('₹80,000.00');
    expect(screen.getByRole('button', { name: 'Local currency' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText(/Rates of/)).not.toBeInTheDocument();
  });

  it('converts to US dollars with the latest rates and shows their date', async () => {
    renderAt('/?currency=USD');

    expect(await screen.findByText('$833.68')).toBeInTheDocument();
    expect(screen.getByText('US dollars at rates of 24 Sep 2026')).toBeInTheDocument();
  });

  it('switches when the toggle is used, and keeps the choice in the URL and the browser', async () => {
    const { router } = renderAt('/');

    await userEvent.setup().click(screen.getByRole('button', { name: 'USD' }));

    expect(await screen.findByText('$833.68')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?currency=USD');
    expect(localStorage.getItem('displayCurrency')).toBe('USD');
  });

  it('remembers the last choice when the URL does not say', async () => {
    localStorage.setItem('displayCurrency', 'USD');

    renderAt('/');

    expect(await screen.findByText('$833.68')).toBeInTheDocument();
  });
});
