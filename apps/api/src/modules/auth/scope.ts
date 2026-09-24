import type { CountryCode, CurrentUser } from '@salary/shared';
import { eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/** What a user may see: every country, or one country. Built from the user on every request. */
export type Scope = { kind: 'all' } | { kind: 'country'; countryCode: CountryCode };

export function scopeFor(user: CurrentUser): Scope {
  if (user.role === 'global_hr') return { kind: 'all' };
  if (user.countryCode === null) {
    throw new Error('A country HR user must have a country');
  }
  return { kind: 'country', countryCode: user.countryCode };
}

/**
 * Condition that limits a query to the scope, for use in `where(and(...))`. Every repository
 * function takes the caller's scope and applies this to the record's country column.
 */
export function scopeCondition(scope: Scope, countryColumn: PgColumn): SQL | undefined {
  return scope.kind === 'all' ? undefined : eq(countryColumn, scope.countryCode);
}

/** Whether a record in a country (null means all countries) is visible in the scope. */
export function isInScope(scope: Scope, countryCode: string | null): boolean {
  return scope.kind === 'all' || scope.countryCode === countryCode;
}
