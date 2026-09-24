import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, problem } from '../test/mock-api.ts';
import { renderApp } from '../test/render-app.tsx';

const signedOut = () => problem(401, 'Sign in to continue');

describe('SetPasswordPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function choose(password: string, confirmation: string) {
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Set password' });
    if (password) await user.type(screen.getByLabelText('New password'), password);
    if (confirmation) await user.type(screen.getByLabelText('Confirm new password'), confirmation);
    await user.click(button);
  }

  it('explains a link without a token', async () => {
    mockApi({ 'GET /api/auth/me': signedOut });
    renderApp('/set-password');

    expect(await screen.findByText(/This link is missing its token/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('asks for a long enough password, typed the same twice', async () => {
    const { calls } = mockApi({ 'GET /api/auth/me': signedOut });
    renderApp('/set-password?token=abc123');

    await choose('short', 'short');
    expect(await screen.findByText('Use at least 12 characters')).toBeInTheDocument();

    await userEvent.setup().clear(screen.getByLabelText('New password'));
    await choose('a long new password', 'a different password');
    expect(await screen.findByText('The passwords do not match')).toBeInTheDocument();

    expect(calls.filter((call) => call.path === '/api/auth/set-password')).toEqual([]);
  });

  it('sets the password with the token from the link and offers to sign in', async () => {
    const { calls } = mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/set-password': () => new Response(null, { status: 204 }),
    });
    renderApp('/set-password?token=abc123');

    await choose('a long new password', 'a long new password');

    expect(await screen.findByText('Your password is set.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(calls.find((call) => call.path === '/api/auth/set-password')?.body).toEqual({
      token: 'abc123',
      password: 'a long new password',
    });
  });

  it('shows the message from the API when the link no longer works', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/set-password': () =>
        problem(400, 'This link is invalid or has expired. Ask for a new one.'),
    });
    renderApp('/set-password?token=used-token');

    await choose('a long new password', 'a long new password');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link is invalid or has expired',
    );
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toBeInTheDocument();
  });
});
