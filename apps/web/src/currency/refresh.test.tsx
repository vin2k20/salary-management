import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalHrUser, indiaHrUser, mockApi, problem } from '../test/mock-api.ts';
import { renderApp } from '../test/render-app.tsx';

const rates24 = { rateDate: '2026-09-24', rates: { USD: '1', INR: '95.96' }, stale: false };
const rates25 = { rateDate: '2026-09-25', rates: { USD: '1', INR: '96.1' }, stale: false };

function ratesSection() {
  return within(screen.getByRole('region', { name: 'Exchange rates' }));
}

describe('refreshing exchange rates by hand', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets a global HR user fetch the latest rates', async () => {
    const { calls } = mockApi({
      'GET /api/auth/me': () => Response.json({ user: globalHrUser }),
      'GET /api/fx-rates/latest': () => Response.json(rates24),
      'POST /api/fx-rates/refresh': () => Response.json({ ...rates25, stored: 4 }),
    });
    renderApp('/');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Refresh rates' }));

    expect(
      await ratesSection().findByText('Rates updated. The latest are from 25 Sep 2026.'),
    ).toBeInTheDocument();
    expect(ratesSection().getByText('1 USD = 96.1 INR')).toBeInTheDocument();
    expect(
      calls.some((call) => call.method === 'POST' && call.path === '/api/fx-rates/refresh'),
    ).toBe(true);
  });

  it('says so when there is nothing newer', async () => {
    mockApi({
      'GET /api/auth/me': () => Response.json({ user: globalHrUser }),
      'GET /api/fx-rates/latest': () => Response.json(rates24),
      'POST /api/fx-rates/refresh': () => Response.json({ ...rates24, stored: 0 }),
    });
    renderApp('/');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Refresh rates' }));

    expect(
      await ratesSection().findByText('No newer rates yet. The latest are from 24 Sep 2026.'),
    ).toBeInTheDocument();
  });

  it('shows the message from the API when the rate service is down', async () => {
    mockApi({
      'GET /api/auth/me': () => Response.json({ user: globalHrUser }),
      'GET /api/fx-rates/latest': () => Response.json(rates24),
      'POST /api/fx-rates/refresh': () =>
        problem(502, 'The exchange rate service is not available. Try again later.'),
    });
    renderApp('/');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Refresh rates' }));

    expect(await ratesSection().findByRole('alert')).toHaveTextContent(
      'The exchange rate service is not available',
    );
  });

  it('does not offer the refresh to country HR users', async () => {
    mockApi({
      'GET /api/auth/me': () => Response.json({ user: indiaHrUser }),
      'GET /api/fx-rates/latest': () => Response.json(rates24),
    });
    renderApp('/');

    await screen.findByRole('region', { name: 'Exchange rates' });
    expect(await ratesSection().findByText('1 USD = 95.96 INR')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh rates' })).not.toBeInTheDocument();
  });
});
