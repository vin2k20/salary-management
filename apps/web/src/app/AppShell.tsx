import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-name">ACME Salary Management</span>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
