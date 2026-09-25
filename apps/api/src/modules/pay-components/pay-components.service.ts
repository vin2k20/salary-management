import {
  COUNTRIES,
  type CountryCode,
  type CreatePayComponentRequest,
  type CurrentUser,
  type PayComponent,
  type PayComponentListResponse,
  type PayFrequencyCode,
  type UpdatePayComponentRequest,
} from '@salary/shared';
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { isUniqueViolation } from '../../db/errors.ts';
import { payComponents, payFrequencies } from '../../db/schema.ts';
import { HttpError } from '../../http/errors.ts';
import type { Scope } from '../auth/scope.ts';
import { diffFields, recordChange } from '../change-log/change-log.ts';

/** Components usable in a country: its own and those for all countries. */
function usableIn(countryCode: CountryCode) {
  return or(eq(payComponents.countryCode, countryCode), isNull(payComponents.countryCode));
}

type ComponentRow = typeof payComponents.$inferSelect;

function toPayComponent(row: ComponentRow): PayComponent {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    countryCode: row.countryCode as CountryCode | null,
    defaultFrequency: row.defaultFrequency as PayFrequencyCode,
    isActive: row.isActive,
  };
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
    items: rows.map(toPayComponent),
    frequencies: frequencies.map((row) => ({
      code: row.code as PayFrequencyCode,
      name: row.name,
      periodsPerYear: row.periodsPerYear,
    })),
  };
}

/** "India", or "all countries" for components without a country. */
function countryLabel(countryCode: string | null): string {
  return countryCode === null ? 'all countries' : COUNTRIES[countryCode as CountryCode].name;
}

/** Fields of a component written to the change log. */
function loggedFields(component: PayComponent): Record<string, unknown> {
  const { id: _id, ...fields } = component;
  return fields;
}

/**
 * Adds a component. Country HR users add components for their own country only. A code must be
 * unique among the components a country can use, so import files match one component: a
 * country's code cannot repeat an all-country code, and an all-country code cannot repeat any
 * country's code.
 */
export async function createPayComponent(
  db: Database,
  scope: Scope,
  input: CreatePayComponentRequest,
  actor: CurrentUser,
  clock: Clock,
): Promise<PayComponent> {
  if (scope.kind === 'country') {
    if (input.countryCode === null) {
      throw new HttpError(403, 'Only global HR users can add components for all countries');
    }
    if (input.countryCode !== scope.countryCode) {
      throw new HttpError(
        403,
        `You can only add components for ${countryLabel(scope.countryCode)}`,
      );
    }
  }
  try {
    return await db.transaction(async (tx) => {
      const [clash] = await tx
        .select({ countryCode: payComponents.countryCode })
        .from(payComponents)
        .where(
          and(
            eq(payComponents.code, input.code),
            input.countryCode === null
              ? undefined
              : or(
                  eq(payComponents.countryCode, input.countryCode),
                  isNull(payComponents.countryCode),
                ),
          ),
        )
        .orderBy(sql`${payComponents.countryCode} nulls first`)
        .limit(1);
      if (clash) {
        throw new HttpError(
          409,
          `A component with the code ${input.code} already exists for ${countryLabel(clash.countryCode)}`,
        );
      }
      const [row] = await tx.insert(payComponents).values(input).returning();
      if (!row) throw new Error('Pay component was not inserted');
      const component = toPayComponent(row);
      await recordChange(
        tx,
        {
          entityType: 'pay_component',
          entityId: component.id,
          action: 'created',
          changes: diffFields(null, loggedFields(component)),
          countryCode: component.countryCode,
          changedBy: actor.id,
        },
        clock,
      );
      return component;
    });
  } catch (error) {
    // The unique constraint also covers two requests adding the same code at once.
    if (isUniqueViolation(error, 'pay_components_code_country_unique')) {
      throw new HttpError(
        409,
        `A component with the code ${input.code} already exists for ${countryLabel(input.countryCode)}`,
      );
    }
    throw error;
  }
}

/**
 * Renames, deactivates or reactivates a component. Components of other countries are treated as
 * missing (404); all-country components are visible to country HR users but only global HR users
 * change them (403). A deactivated component stays on existing pay items but cannot be used in
 * new pay changes.
 */
export async function updatePayComponent(
  db: Database,
  scope: Scope,
  id: string,
  update: UpdatePayComponentRequest,
  actor: CurrentUser,
  clock: Clock,
): Promise<PayComponent> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(payComponents)
      .where(
        and(
          eq(payComponents.id, id),
          scope.kind === 'country' ? usableIn(scope.countryCode) : undefined,
        ),
      );
    if (!row) throw new HttpError(404, 'Pay component not found');
    if (scope.kind === 'country' && row.countryCode === null) {
      throw new HttpError(403, 'Only global HR users can change components for all countries');
    }
    const [updated] = await tx
      .update(payComponents)
      .set({ ...update, updatedAt: clock.now() })
      .where(eq(payComponents.id, id))
      .returning();
    if (!updated) throw new HttpError(404, 'Pay component not found');
    const before = toPayComponent(row);
    const after = toPayComponent(updated);
    await recordChange(
      tx,
      {
        entityType: 'pay_component',
        entityId: id,
        action: before.isActive && !after.isActive ? 'inactivated' : 'updated',
        changes: diffFields(loggedFields(before), loggedFields(after)),
        countryCode: after.countryCode,
        changedBy: actor.id,
      },
      clock,
    );
    return after;
  });
}
