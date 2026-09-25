import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { globalHrUser } from '../test/mock-api.ts';
import { AppShell } from './AppShell.tsx';

function renderShell() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AppShell user={globalHrUser}>Page content</AppShell>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppShell', () => {
  it('shows the application name, the signed-in user and the page content', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AppShell user={globalHrUser}>Page content</AppShell>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('banner')).toHaveTextContent('ACME Salary Management');
    expect(screen.getByRole('banner')).toHaveTextContent('Global HR, all countries');
    expect(screen.getByRole('main')).toHaveTextContent('Page content');
  });

  it('lets keyboard users skip to the content, then reach controls in screen order', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Local currency' })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus();
  });
});
