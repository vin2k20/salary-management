import { EMPLOYEE_COLUMNS, PAY_COLUMNS, importSummarySchema } from '@salary/shared';
import { count, eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../db/client.ts';
import { changeLog, employees, payChanges, payItems } from '../../db/schema.ts';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertExportData } from '../../test/export-data.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

const EMPLOYEE_HEADER = EMPLOYEE_COLUMNS.map((column) => column.header).join(',');

async function counts(db: Database) {
  const [[people], [log], [changes]] = await Promise.all([
    db.select({ n: count() }).from(employees),
    db.select({ n: count() }).from(changeLog),
    db.select({ n: count() }).from(payChanges),
  ]);
  return { employees: people?.n, changeLog: log?.n, payChanges: changes?.n };
}

describe('POST /api/imports/commit', () => {
  let db: Database;
  let globalCookie: string;
  let indiaCookie: string;

  beforeAll(async () => {
    ({ db } = await sharedTestDatabase());
    await insertExportData(db);
    globalCookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
    indiaCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
  });

  async function commit(file: Buffer, name: string, cookie = globalCookie) {
    const { app } = await createTestApp();
    return request(app)
      .post('/api/imports/commit')
      .set('Cookie', cookie)
      .set('X-Requested-With', 'fetch')
      .attach('file', file, name);
  }

  it('saves nothing when any row is invalid', async () => {
    const before = await counts(db);

    const response = await commit(
      Buffer.from(
        `${EMPLOYEE_HEADER}\r\nIN-7,Kavya,Iyer,kavya@example.com,Data Analyst,,Data,IN,Maharashtra,full_time,1,2026-01-05,active,,,,yes,no\r\nIN-8,Arjun,,arjun@example.com,Data Analyst,,Data,IN,Maharashtra,full_time,1,2026-01-05,active,,,,yes,no\r\n`,
      ),
      'employees.csv',
    );

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      detail: 'The file has 1 problem. Check it again to see the list.',
    });
    expect(await counts(db)).toEqual(before);
  });

  it('keeps a country HR user to their own country', async () => {
    const before = await counts(db);

    const response = await commit(
      Buffer.from(
        `${EMPLOYEE_HEADER}\r\nUS-5,Liam,Brown,liam@example.com,Account Executive,,Sales,US,Texas,full_time,1,2026-01-05,active,,exempt,,,\r\n`,
      ),
      'employees.csv',
      indiaCookie,
    );

    expect(response.status).toBe(422);
    expect(await counts(db)).toEqual(before);
  });

  it('adds, updates and changes pay in one go, with the change log', async () => {
    const book = new ExcelJS.Workbook();
    const people = book.addWorksheet('Employees');
    people.addRow(EMPLOYEE_COLUMNS.map((column) => column.header));
    people.addRow([
      'IN-9',
      'Priya',
      'Patel',
      'priya.patel@example.com',
      'data analyst',
      null,
      'Data',
      'IN',
      'Maharashtra',
      'full_time',
      1,
      '2026-01-05',
      'active',
      null,
      null,
      null,
      'yes',
      'no',
    ]);
    people.addRow([
      'IN-1',
      'Aarav',
      'Sharma',
      'aarav.sharma@example.com',
      'Software Engineer',
      'L2',
      'Platform',
      'IN',
      'Karnataka',
      'full_time',
      1,
      '2025-01-01',
      'active',
      null,
      null,
      null,
      'yes',
      'no',
    ]);
    const pay = book.addWorksheet('Pay components');
    pay.addRow(PAY_COLUMNS.map((column) => column.header));
    pay.addRow(['IN-9', 'basic', 60000, 'INR', 'monthly', '2026-01-05']);
    pay.addRow(['IN-1', 'hra', 25000, 'INR', 'monthly', '2026-10-01']);
    pay.addRow(['IN-1', 'basic', 50000, 'INR', 'monthly', '2025-01-01']);

    const response = await commit(Buffer.from(await book.xlsx.writeBuffer()), 'salary.xlsx');

    expect(response.status).toBe(200);
    expect(importSummarySchema.parse(response.body)).toMatchObject({
      valid: true,
      employees: { added: 1, updated: 1, unchanged: 0 },
      pay: { changed: 2, unchanged: 1 },
    });

    const [priya] = await db.select().from(employees).where(eq(employees.employeeCode, 'IN-9'));
    expect(priya).toMatchObject({ firstName: 'Priya', jobTitle: 'data analyst', status: 'active' });
    const [aarav] = await db.select().from(employees).where(eq(employees.employeeCode, 'IN-1'));
    expect(aarav?.department).toBe('Platform');

    const imported = await db
      .select({ employeeId: payChanges.employeeId, effectiveFrom: payChanges.effectiveFrom })
      .from(payChanges)
      .where(eq(payChanges.reason, 'import'));
    expect(imported).toEqual(
      expect.arrayContaining([
        { employeeId: priya?.id, effectiveFrom: '2026-01-05' },
        { employeeId: aarav?.id, effectiveFrom: '2026-10-01' },
      ]),
    );
    const hra = await db
      .select({ amountMinor: payItems.amountMinor, effectiveTo: payItems.effectiveTo })
      .from(payItems)
      .where(eq(payItems.employeeId, aarav?.id ?? ''));
    expect(hra).toEqual(
      expect.arrayContaining([
        { amountMinor: 2_000_050, effectiveTo: '2026-10-01' },
        { amountMinor: 2_500_000, effectiveTo: null },
      ]),
    );

    const log = await db
      .select({ entityType: changeLog.entityType, action: changeLog.action })
      .from(changeLog);
    expect(log).toEqual(
      expect.arrayContaining([
        { entityType: 'employee', action: 'created' },
        { entityType: 'employee', action: 'updated' },
        { entityType: 'pay_change', action: 'created' },
      ]),
    );
  });

  it('checks the file again, so a file that became invalid saves nothing', async () => {
    // IN-1 now has a pay change on 1 Oct 2026, so a change dated before it is refused.
    const before = await counts(db);

    const response = await commit(
      Buffer.from(
        `${PAY_COLUMNS.map((column) => column.header).join(',')}\r\nIN-1,basic,52000.00,INR,monthly,2026-09-30\r\n`,
      ),
      'pay.csv',
    );

    expect(response.status).toBe(422);
    expect(await counts(db)).toEqual(before);
  });
});
