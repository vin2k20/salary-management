import { COUNTRIES, type CurrentUser } from '@salary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { currentUserQueryKey, logout } from '../auth/session.ts';
import { Button } from '../components/ui/button.tsx';
import { CurrencyToggle } from '../currency/CurrencyToggle.tsx';
import { cn } from '../lib/cn.ts';
import { NAVIGATION } from './navigation.ts';

export function roleLabel(user: CurrentUser): string {
  return user.countryCode === null
    ? 'Global HR, all countries'
    : `Country HR, ${COUNTRIES[user.countryCode].name}`;
}

export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const items = NAVIGATION.filter((item) => !item.roles || item.roles.includes(user.role));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signOut = useMutation({
    mutationFn: logout,
    onSettled: async () => {
      // Mark the user as signed out, then drop every other cached answer so no pay data stays
      // in memory. Keeping the current-user entry avoids asking the API again.
      queryClient.setQueryData(currentUserQueryKey, null);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== currentUserQueryKey[0],
      });
      await navigate('/login', { replace: true });
    },
  });

  const navigation = (
    <nav aria-label="Main" className="-mx-1 flex w-full gap-1 overflow-x-auto px-1 pb-2">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground',
              isActive && 'bg-secondary text-secondary-foreground',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only rounded-md bg-background px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to main content
      </a>
      <header className="border-b bg-card">
        {/* Title and account controls on the first row, the navigation on its own row below,
            in the same order for the keyboard as on screen. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 pt-3 sm:px-6">
          <span className="font-semibold whitespace-nowrap">ACME Salary Management</span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <CurrencyToggle />
            <div className="text-right text-sm leading-tight">
              <div className="font-medium">{user.name}</div>
              <div className="text-muted-foreground">{roleLabel(user)}</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={signOut.isPending}
              onClick={() => {
                signOut.mutate();
              }}
            >
              Sign out
            </Button>
          </div>
          {navigation}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 outline-none sm:px-6">
        {children}
      </main>
    </div>
  );
}
