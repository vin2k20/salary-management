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

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-6">
          <span className="font-semibold">ACME Salary Management</span>
          <nav aria-label="Main" className="flex gap-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground',
                    isActive && 'bg-secondary text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
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
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
