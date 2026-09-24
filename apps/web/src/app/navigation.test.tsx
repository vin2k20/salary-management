import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalHrUser, healthy, indiaHrUser, mockApi, problem } from '../test/mock-api.ts';
import { renderApp } from '../test/render-app.tsx';

describe('protected routes and navigation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a signed-out user to the login page and back to the page they asked for', async () => {
    mockApi({
      'GET /api/auth/me': () => problem(401, 'Sign in to continue'),
      'POST /api/auth/login': () => Response.json({ user: globalHrUser }),
    });
    const { router } = renderApp('/users');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'global.hr@acme.example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/users');
    });
  });

  it('shows the Users page to global HR users', async () => {
    mockApi({
      'GET /api/auth/me': () => Response.json({ user: globalHrUser }),
      'GET /api/health': healthy,
    });
    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByText('Global HR')).toBeInTheDocument();
  });

  it('hides the Users page from country HR users, and shows their country', async () => {
    mockApi({
      'GET /api/auth/me': () => Response.json({ user: indiaHrUser }),
      'GET /api/health': healthy,
    });
    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.getByText('India HR')).toBeInTheDocument();
    expect(screen.getByText('Country HR, India')).toBeInTheDocument();
  });

  it('tells a country HR user who opens the Users page that it is not available to them', async () => {
    mockApi({ 'GET /api/auth/me': () => Response.json({ user: indiaHrUser }) });
    renderApp('/users');

    expect(await screen.findByText('You do not have access to this page.')).toBeInTheDocument();
  });

  it('sends a signed-in user away from the login page', async () => {
    mockApi({
      'GET /api/auth/me': () => Response.json({ user: globalHrUser }),
      'GET /api/health': healthy,
    });
    const { router } = renderApp('/login');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });
});
