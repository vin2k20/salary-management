import { isDeepStrictEqual } from 'node:util';
import type {
  ChangeLogAction,
  ChangeLogEntityType,
  ChangeLogEntry as ChangeLogItem,
  FieldChanges,
} from '@salary/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { Clock } from '../../clock.ts';
import type { Database } from '../../db/client.ts';
import { changeLog, users } from '../../db/schema.ts';
import { scopeCondition, type Scope } from '../auth/scope.ts';

export interface ChangeLogEntry {
  entityType: ChangeLogEntityType;
  entityId: string;
  action: ChangeLogAction;
  changes: FieldChanges;
  /** Country of the record, for country HR scope; null for users and all-country components. */
  countryCode: string | null;
  changedBy: string | null;
}

/**
 * Old and new values of the fields that differ between two versions of a record. Pass null as
 * `before` for a new record. Values are compared by content.
 */
export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): FieldChanges {
  const changes: FieldChanges = {};
  for (const [field, newValue] of Object.entries(after)) {
    const oldValue = before === null ? null : (before[field] ?? null);
    if (before === null || !isDeepStrictEqual(oldValue, newValue ?? null)) {
      changes[field] = { old: oldValue, new: newValue ?? null };
    }
  }
  return changes;
}

/**
 * Writes one change log entry. Services call it with their transaction, so the entry is saved
 * only if the change itself is saved. An update that changed nothing is not logged.
 */
export async function recordChange(db: Database, entry: ChangeLogEntry, clock: Clock) {
  if (entry.action === 'updated' && Object.keys(entry.changes).length === 0) {
    return;
  }
  await db.insert(changeLog).values({ ...entry, changedAt: clock.now() });
}

/**
 * Change log of one record, newest first, with who made each change. Only entries for countries
 * in the caller's scope are read; callers also check that the record itself is in scope.
 */
export async function changeLogFor(
  db: Database,
  scope: Scope,
  entityType: ChangeLogEntityType,
  entityId: string,
): Promise<ChangeLogItem[]> {
  const rows = await db
    .select({
      id: changeLog.id,
      action: changeLog.action,
      changes: changeLog.changes,
      changedAt: changeLog.changedAt,
      changedById: users.id,
      changedByName: users.name,
    })
    .from(changeLog)
    .leftJoin(users, eq(users.id, changeLog.changedBy))
    .where(
      and(
        eq(changeLog.entityType, entityType),
        eq(changeLog.entityId, entityId),
        scopeCondition(scope, changeLog.countryCode),
      ),
    )
    .orderBy(desc(changeLog.changedAt));
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    changes: row.changes,
    changedAt: row.changedAt.toISOString(),
    changedBy:
      row.changedById && row.changedByName
        ? { id: row.changedById, name: row.changedByName }
        : null,
  }));
}
