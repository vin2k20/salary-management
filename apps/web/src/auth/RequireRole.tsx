import type { Role } from '@salary/shared';
import type { ReactNode } from 'react';
import { useCurrentUser } from './session.ts';

/**
 * Shows a page only to users with the role. The API enforces the same rule; this only avoids
 * showing a page the user cannot use.
 */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { data: user } = useCurrentUser();
  if (user?.role !== role) {
    return <p className="text-sm">You do not have access to this page.</p>;
  }
  return children;
}
