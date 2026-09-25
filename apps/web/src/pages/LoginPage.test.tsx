import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalHrUser, mockApi, problem } from '../test/mock-api.ts';
import { renderApp } from '../test/render-app.tsx';

const signedOut = () => problem(401, 'Sign in to continue');

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function fillIn(email: string, password: string) {
    const user = userEvent.setup();
    const submit = await screen.findByRole('button', { name: 'Sign in' });
    if (email) await user.type(screen.getByLabelText('Email'), email);
    if (password) await user.type(screen.getByLabelText('Password'), password);
    await user.click(submit);
  }

  it('asks for an email and password before sending anything', async () => {
    const { calls } = mockApi({ 'GET /api/auth/me': signedOut });
    renderApp('/login');

    await fillIn('', '');

    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(calls.filter((call) => call.path === '/api/auth/login')).toEqual([]);
  });

  it('explains an invalid email address', async () => {
    mockApi({ 'GET /api/auth/me': signedOut });
    renderApp('/login');

    await fillIn('not-an-email', 'secret');

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('shows the message from the API when the email or password is wrong', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': () => problem(401, 'Email or password is incorrect'),
    });
    renderApp('/login');

    await fillIn('global.hr@acme.example.com', 'wrong password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('shows the message from the API when there were too many attempts', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': () =>
        problem(429, 'Too many sign-in attempts. Try again in 15 minutes.'),
    });
    renderApp('/login');

    await fillIn('global.hr@acme.example.com', 'wrong password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many sign-in attempts');
  });

  it('signs in with the normalised email and opens the home page', async () => {
    const { calls } = mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': () => Response.json({ user: globalHrUser }),
    });
    const { router } = renderApp('/login');

    await fillIn(' Global.HR@acme.example.com', 'correct horse battery staple');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(await screen.findByText('Global HR')).toBeInTheDocument();
    expect(calls.find((call) => call.path === '/api/auth/login')?.body).toEqual({
      email: 'global.hr@acme.example.com',
      password: 'correct horse battery staple',
    });
  });
});
