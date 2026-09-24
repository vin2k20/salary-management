import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell.tsx';

describe('AppShell', () => {
  it('shows the application name and the page content', () => {
    render(<AppShell>Page content</AppShell>);

    expect(screen.getByRole('banner')).toHaveTextContent('ACME Salary Management');
    expect(screen.getByRole('main')).toHaveTextContent('Page content');
  });
});
