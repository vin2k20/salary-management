import type { CountryCode, PayComponentListResponse, PayFrequencyCode } from '@salary/shared';
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.ts';
import { payComponents, payFrequencies } from '../../db/schema.ts';
import type { Scope } from '../auth/scope.ts';

/** Components usable in a country: its own and those for all countries. */
function usableIn(countryCode: CountryCode) {
  return or(eq(payComponents.countryCode, countryCode), isNull(payComponents.countryCode));
}

/**
 * The component catalogue within the caller's scope, and the pay frequencies. A country HR user
 * sees their country's components and those for all countries.
 */
export async function listPayComponents(
  db: Database,
  scope: Scope,
  country: CountryCode | undefined,
): Promise<PayComponentListResponse> {
  const [rows, frequencies] = await Promise.all([
    db
      .select()
      .from(payComponents)
      .where(
        and(
          scope.kind === 'country' ? usableIn(scope.countryCode) : undefined,
          country ? usableIn(country) : undefined,
        ),
      )
      .orderBy(sql`${payComponents.countryCode} nulls first`, asc(payComponents.name)),
    db
      .select()
      .from(payFrequencies)
      .orderBy(desc(payFrequencies.periodsPerYear), asc(payFrequencies.name)),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      countryCode: row.countryCode as CountryCode | null,
      defaultFrequency: row.defaultFrequency as PayFrequencyCode,
      isActive: row.isActive,
    })),
    frequencies: frequencies.map((row) => ({
      code: row.code as PayFrequencyCode,
      name: row.name,
      periodsPerYear: row.periodsPerYear,
    })),
  };
}
