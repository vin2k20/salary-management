import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, problem } from '../test/mock-api.ts';
import { renderApp } from '../test/render-app.tsx';

const signedOut = () => problem(401, 'Sign in to continue');

describe('ForgotPasswordPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function submit(email: string) {
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Send link' });
    if (email) await user.type(screen.getByLabelText('Email'), email);
    await user.click(button);
  }

  it('is linked from the login page', async () => {
    mockApi({ 'GET /api/auth/me': signedOut });
    renderApp('/login');

    expect(await screen.findByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('asks for a valid email before sending anything', async () => {
    const { calls } = mockApi({ 'GET /api/auth/me': signedOut });
    renderApp('/forgot-password');

    await submit('');

    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(calls.filter((call) => call.path === '/api/auth/forgot-password')).toEqual([]);
  });

  it('sends the normalised email and gives the same answer for any email', async () => {
    const { calls } = mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/forgot-password': () => new Response(null, { status: 202 }),
    });
    renderApp('/forgot-password');

    await submit(' HR.IN@acme.example.com');

    expect(
      await screen.findByText(/If an account uses that email, we have sent a link/),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.path === '/api/auth/forgot-password')?.body).toEqual({
      email: 'hr.in@acme.example.com',
    });
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });

  it('shows the message from the API when there were too many requests', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/forgot-password': () =>
        problem(429, 'Too many requests for this email. Try again in 15 minutes.'),
    });
    renderApp('/forgot-password');

    await submit('hr.in@acme.example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests for this email');
  });
});
