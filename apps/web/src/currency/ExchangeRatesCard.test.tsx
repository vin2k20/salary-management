import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { indiaHrUser, mockApi } from '../test/mock-api.ts';
import { ExchangeRatesCard } from './ExchangeRatesCard.tsx';

function renderCard(rates: object) {
  mockApi({
    'GET /api/auth/me': () => Response.json({ user: indiaHrUser }),
    'GET /api/fx-rates/latest': () => Response.json(rates),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ExchangeRatesCard />
    </QueryClientProvider>,
  );
}

describe('ExchangeRatesCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the latest rates and their date', async () => {
    renderCard({
      rateDate: '2026-09-24',
      rates: { USD: '1', CAD: '1.4117', AUD: '1.4232', INR: '95.96' },
      stale: false,
    });

    expect(await screen.findByText('1 USD = 95.96 INR')).toBeInTheDocument();
    expect(screen.getByText('1 USD = 1.4117 CAD')).toBeInTheDocument();
    expect(screen.getByText('Rates of 24 Sep 2026')).toBeInTheDocument();
    expect(screen.queryByText(/more than 3 days old/)).not.toBeInTheDocument();
  });

  it('warns when the rates are more than three days old', async () => {
    renderCard({ rateDate: '2026-09-01', rates: { USD: '1', INR: '88.2' }, stale: true });

    expect(
      await screen.findByText(
        'These rates are more than 3 days old, so amounts in US dollars may be out of date.',
      ),
    ).toBeInTheDocument();
  });
});
