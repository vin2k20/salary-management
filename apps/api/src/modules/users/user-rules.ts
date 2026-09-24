import type { Role, UpdateUserRequest } from '@salary/shared';

export interface UserAccess {
  id: string;
  role: Role;
  countryCode: string | null;
  isActive: boolean;
}

export type UserUpdateCheck =
  { ok: true; next: Omit<UserAccess, 'id'> } | { ok: false; field?: string; message: string };

/**
 * Checks a change to a user against their current values: a country HR user keeps exactly one
 * country, a global HR user has none, and nobody can deactivate themselves or change their own
 * role (so the last global HR user cannot lock everyone out).
 */
export function checkUserUpdate(
  actorId: string,
  target: UserAccess,
  update: UpdateUserRequest,
): UserUpdateCheck {
  const changesOwnAccess =
    update.isActive === false || (update.role !== undefined && update.role !== target.role);
  if (target.id === actorId && changesOwnAccess) {
    return { ok: false, message: 'You cannot deactivate yourself or change your own role' };
  }

  const role = update.role ?? target.role;
  const countryCode = update.countryCode === undefined ? target.countryCode : update.countryCode;
  if (role === 'country_hr' && countryCode === null) {
    return { ok: false, field: 'countryCode', message: 'Choose the country this user manages' };
  }
  if (role === 'global_hr' && countryCode !== null) {
    return {
      ok: false,
      field: 'countryCode',
      message: 'Global HR users are not tied to a country',
    };
  }
  return { ok: true, next: { role, countryCode, isActive: update.isActive ?? target.isActive } };
}
