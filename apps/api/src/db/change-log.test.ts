import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database.ts';
import { changeLog } from './schema.ts';

describe('change log table', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  const entry = {
    entityType: 'employee' as const,
    entityId: randomUUID(),
    action: 'updated' as const,
    changes: { department: { old: 'Sales', new: 'Marketing' } },
    countryCode: 'CA',
    changedAt: new Date('2026-09-24T10:00:00Z'),
  };

  it('stores old and new values as JSON', async () => {
    const [row] = await database.db.insert(changeLog).values(entry).returning();

    expect(row).toMatchObject({
      changes: { department: { old: 'Sales', new: 'Marketing' } },
      changedAt: new Date('2026-09-24T10:00:00Z'),
    });
  });

  it('rejects an unknown entity type or action', async () => {
    await expect(
      database.db
        .insert(changeLog)
        .values({ ...entry, entityType: 'invoice' as unknown as 'employee' }),
    ).rejects.toThrow();
    await expect(
      database.db.insert(changeLog).values({ ...entry, action: 'deleted' as unknown as 'updated' }),
    ).rejects.toThrow();
  });
});
