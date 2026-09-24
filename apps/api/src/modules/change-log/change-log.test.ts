import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Clock } from '../../clock.ts';
import { changeLog, employees } from '../../db/schema.ts';
import { insertEmployee } from '../../test/fixtures.ts';
import { createTestDatabase, type TestDatabase } from '../../test/test-database.ts';
import { changeLogFor, diffFields, recordChange } from './change-log.ts';

const fixedClock: Clock = { now: () => new Date('2026-09-24T10:00:00Z') };

describe('diffFields', () => {
  it('lists only the fields whose values changed, with old and new values', () => {
    expect(
      diffFields(
        { department: 'Sales', jobTitle: 'Analyst', fte: 1 },
        { department: 'Marketing', jobTitle: 'Analyst', fte: 0.8 },
      ),
    ).toEqual({
      department: { old: 'Sales', new: 'Marketing' },
      fte: { old: 1, new: 0.8 },
    });
  });

  it('compares nested values by content', () => {
    expect(
      diffFields(
        { countryFields: { flsaStatus: 'exempt' }, jobLevel: null },
        { countryFields: { flsaStatus: 'exempt' }, jobLevel: null },
      ),
    ).toEqual({});
    expect(diffFields({ countryFields: { flsaStatus: 'exempt' } }, { countryFields: {} })).toEqual({
      countryFields: { old: { flsaStatus: 'exempt' }, new: {} },
    });
  });

  it('treats every field of a new record as changed from null', () => {
    expect(diffFields(null, { department: 'Sales', jobLevel: null })).toEqual({
      department: { old: null, new: 'Sales' },
      jobLevel: { old: null, new: null },
    });
  });
});

describe('recordChange', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  async function logFor(entityId: string) {
    return database.db.select().from(changeLog).where(eq(changeLog.entityId, entityId));
  }

  it('records old and new values with the time from the clock', async () => {
    const employee = await insertEmployee(database.db, { department: 'Sales' });

    await database.db.transaction(async (tx) => {
      await tx
        .update(employees)
        .set({ department: 'Marketing' })
        .where(eq(employees.id, employee.id));
      await recordChange(
        tx,
        {
          entityType: 'employee',
          entityId: employee.id,
          action: 'updated',
          changes: diffFields({ department: 'Sales' }, { department: 'Marketing' }),
          countryCode: employee.countryCode,
          changedBy: null,
        },
        fixedClock,
      );
    });

    expect(await logFor(employee.id)).toEqual([
      expect.objectContaining({
        entityType: 'employee',
        action: 'updated',
        changes: { department: { old: 'Sales', new: 'Marketing' } },
        countryCode: 'IN',
        changedAt: new Date('2026-09-24T10:00:00Z'),
      }),
    ]);
  });

  it('writes nothing when the transaction fails, so the log never disagrees with the data', async () => {
    const employee = await insertEmployee(database.db, { department: 'Sales' });

    await expect(
      database.db.transaction(async (tx) => {
        await tx
          .update(employees)
          .set({ department: 'Marketing' })
          .where(eq(employees.id, employee.id));
        await recordChange(
          tx,
          {
            entityType: 'employee',
            entityId: employee.id,
            action: 'updated',
            changes: { department: { old: 'Sales', new: 'Marketing' } },
            countryCode: employee.countryCode,
            changedBy: null,
          },
          fixedClock,
        );
        throw new Error('Later step failed');
      }),
    ).rejects.toThrow('Later step failed');

    const [unchanged] = await database.db
      .select({ department: employees.department })
      .from(employees)
      .where(eq(employees.id, employee.id));
    expect(unchanged?.department).toBe('Sales');
    expect(await logFor(employee.id)).toEqual([]);
  });

  it('skips an update that changed nothing', async () => {
    const employee = await insertEmployee(database.db);

    await recordChange(
      database.db,
      {
        entityType: 'employee',
        entityId: employee.id,
        action: 'updated',
        changes: {},
        countryCode: employee.countryCode,
        changedBy: null,
      },
      fixedClock,
    );

    expect(await logFor(employee.id)).toEqual([]);
  });

  it('reads entries newest first, only for countries in the caller scope', async () => {
    const employee = await insertEmployee(database.db);
    const entry = (countryCode: string, department: string) => ({
      entityType: 'employee' as const,
      entityId: employee.id,
      action: 'updated' as const,
      changes: { department: { old: null, new: department } },
      countryCode,
      changedBy: null,
    });
    await recordChange(database.db, entry('US', 'Sales'), fixedClock);
    await recordChange(database.db, entry('IN', 'Marketing'), {
      now: () => new Date('2026-09-25T10:00:00Z'),
    });

    const all = await changeLogFor(database.db, { kind: 'all' }, 'employee', employee.id);
    const india = await changeLogFor(
      database.db,
      { kind: 'country', countryCode: 'IN' },
      'employee',
      employee.id,
    );

    expect(all.map((item) => item.changes.department?.new)).toEqual(['Marketing', 'Sales']);
    expect(india.map((item) => item.changes.department?.new)).toEqual(['Marketing']);
  });
});
