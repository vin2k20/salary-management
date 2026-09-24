import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { globalHrUser } from '../test/mock-api.ts';
import { AppShell } from './AppShell.tsx';

describe('AppShell', () => {
  it('shows the application name, the signed-in user and the page content', () => {
    render(
      <MemoryRouter>
        <AppShell user={globalHrUser}>Page content</AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole('banner')).toHaveTextContent('ACME Salary Management');
    expect(screen.getByRole('banner')).toHaveTextContent('Global HR, all countries');
    expect(screen.getByRole('main')).toHaveTextContent('Page content');
  });
});
