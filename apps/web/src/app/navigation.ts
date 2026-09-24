import type { Role } from '@salary/shared';

export interface NavigationItem {
  to: string;
  label: string;
  /** Roles that may see the item; all roles when not set. */
  roles?: Role[];
}

export const NAVIGATION: NavigationItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/users', label: 'Users', roles: ['global_hr'] },
];
