import { importSummarySchema } from '@salary/shared';
import { count } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../db/client.ts';
import { changeLog } from '../../db/schema.ts';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertExportData } from '../../test/export-data.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('exporting then importing the same file', () => {
  let db: Database;
  let cookie: string;

  beforeAll(async () => {
    ({ db } = await sharedTestDatabase());
    await insertExportData(db);
    cookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
  });

  async function exported(query: Record<string, string>) {
    const { app } = await createTestApp();
    const response = await request(app)
      .get('/api/exports')
      .query({ includeInactive: 'true', ...query })
      .set('Cookie', cookie)
      .responseType('blob');
    expect(response.status).toBe(200);
    return response.body as Buffer;
  }

  async function upload(step: 'validate' | 'commit', file: Buffer, name: string) {
    const { app } = await createTestApp();
    const response = await request(app)
      .post(`/api/imports/${step}`)
      .set('Cookie', cookie)
      .set('X-Requested-With', 'fetch')
      .attach('file', file, name);
    expect(response.status).toBe(200);
    return importSummarySchema.parse(response.body);
  }

  async function changeLogSize() {
    const [row] = await db.select({ n: count() }).from(changeLog);
    return row?.n;
  }

  it('changes nothing with an Excel file', async () => {
    const file = await exported({ format: 'xlsx' });
    const before = await changeLogSize();

    // Every employee and current pay row is recognised, including a job title that looks like
    // a formula, an inactive employee and pay with a raise scheduled after today.
    const unchanged = {
      valid: true,
      employees: { added: 0, updated: 0, unchanged: 4 },
      pay: { changed: 0, unchanged: 5 },
      changes: [],
      errors: [],
      errorCount: 0,
    };
    expect(await upload('validate', file, 'salary.xlsx')).toEqual(unchanged);
    expect(await upload('commit', file, 'salary.xlsx')).toEqual(unchanged);
    expect(await changeLogSize()).toBe(before);
  });

  it('changes nothing with CSV files, whose formula escaping is taken off again', async () => {
    const employees = await exported({ format: 'csv', dataset: 'employees' });
    const pay = await exported({ format: 'csv', dataset: 'pay' });

    expect(await upload('commit', employees, 'employees.csv')).toMatchObject({
      employees: { added: 0, updated: 0, unchanged: 4 },
      changes: [],
    });
    expect(await upload('commit', pay, 'pay.csv')).toMatchObject({
      pay: { changed: 0, unchanged: 5 },
      changes: [],
    });
  });
});
