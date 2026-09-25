import type { Role } from '@salary/shared';

export interface NavigationItem {
  to: string;
  label: string;
  /** Roles that may see the item; all roles when not set. */
  roles?: Role[];
}

export const NAVIGATION: NavigationItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/employees', label: 'Employees' },
  { to: '/pay-components', label: 'Pay components' },
  { to: '/import', label: 'Import' },
  { to: '/users', label: 'Users', roles: ['global_hr'] },
];
