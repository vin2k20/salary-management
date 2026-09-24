import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalHrUser, healthy, mockApi, problem } from '../test/mock-api.ts';
import { renderApp } from '../test/render-app.tsx';

describe('logout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ends the session and shows the login page', async () => {
    // Like the API: once the session cookie is cleared, the current user is gone.
    let signedIn = true;
    const { calls } = mockApi({
      'GET /api/auth/me': () =>
        signedIn ? Response.json({ user: globalHrUser }) : problem(401, 'Sign in to continue'),
      'GET /api/health': healthy,
      'POST /api/auth/logout': () => {
        signedIn = false;
        return new Response(null, { status: 204 });
      },
    });
    const { router } = renderApp('/');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(calls.some((call) => call.method === 'POST' && call.path === '/api/auth/logout')).toBe(
      true,
    );
    expect(screen.queryByText('Global HR')).not.toBeInTheDocument();

    // Opening a page again after signing out leads back to the login page.
    await router.navigate('/');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    });
  });
});
