import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
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
    expect(screen.getByRole('button', { name: 'Light' })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus();
  });
});

describe('AppShell theme switch', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  it('offers Light and Dark, with Light chosen at first', () => {
    renderShell();

    const group = screen.getByRole('group', { name: 'Colour theme' });
    expect(within(group).getByRole('button', { name: 'Light' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'Dark' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('switches the page to dark and remembers the choice', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Dark' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows Dark as chosen when the page was opened in dark', () => {
    document.documentElement.dataset.theme = 'dark';
    renderShell();

    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  });
});
