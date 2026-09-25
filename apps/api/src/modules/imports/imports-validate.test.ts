import {
  EMPLOYEE_COLUMNS,
  PAY_COLUMNS,
  importSummarySchema,
  type ImportSummary,
} from '@salary/shared';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { parseCsv } from '../../test/csv.ts';
import { insertExportData } from '../../test/export-data.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

const EMPLOYEE_HEADER = EMPLOYEE_COLUMNS.map((column) => column.header).join(',');
const PAY_HEADER = PAY_COLUMNS.map((column) => column.header).join(',');

/** A new employee in India as a CSV line, in the template's column order. */
function newIndian(code: string, hireDate = '2026-01-05') {
  return `${code},Priya,Patel,${code.toLowerCase()}@example.com,Data Analyst,,Data,IN,Maharashtra,full_time,1,${hireDate},active,,,,yes,no`;
}

describe('POST /api/imports/validate', () => {
  let globalCookie: string;
  let indiaCookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    await insertExportData(db);
    globalCookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
    indiaCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
  });

  async function validate(
    text: string,
    { cookie = globalCookie, name = 'employees.csv' }: { cookie?: string; name?: string } = {},
  ): Promise<ImportSummary> {
    const { app } = await createTestApp();
    const response = await request(app)
      .post('/api/imports/validate')
      .set('Cookie', cookie)
      .set('X-Requested-With', 'fetch')
      .attach('file', Buffer.from(text, 'utf8'), name);
    expect(response.status).toBe(200);
    return importSummarySchema.parse(response.body);
  }

  it('previews the employees a file adds and updates', async () => {
    const body = await validate(
      `${EMPLOYEE_HEADER}\r\n${newIndian('IN-9')}\r\nIN-1,Aarav,Sharma,aarav.sharma@example.com,Senior Software Engineer,L3,Engineering,IN,Karnataka,full_time,1,2025-01-01,active,,,,yes,no\r\n`,
    );

    expect(body).toEqual({
      valid: true,
      employees: { added: 1, updated: 1, unchanged: 0 },
      pay: { changed: 0, unchanged: 0 },
      changes: [
        {
          sheet: 'Employees',
          row: 2,
          employeeCode: 'IN-9',
          action: 'add',
          details: 'Priya Patel, Data Analyst',
        },
        {
          sheet: 'Employees',
          row: 3,
          employeeCode: 'IN-1',
          action: 'update',
          details: 'Job title, Job level',
        },
      ],
      errors: [],
      errorCount: 0,
    });
  });

  it('lists every problem by row and column, and saves nothing', async () => {
    const body = await validate(
      `${PAY_HEADER}\r\nIN-1,basic,55000,INR,monthly,2026-13-01\r\nIN-1,bonus,1000,INR,yearly,2026-10-01\r\n`,
      { name: 'pay.csv' },
    );

    expect(body).toMatchObject({
      valid: false,
      errorCount: 2,
      errors: [
        {
          sheet: 'Pay components',
          row: 2,
          column: 'Effective from',
          message: 'Enter a valid date',
        },
        {
          sheet: 'Pay components',
          row: 3,
          column: 'Component code',
          message: 'No component with the code bonus is used in India',
        },
      ],
    });
  });

  it('reads Excel files with both sheets', async () => {
    const book = new ExcelJS.Workbook();
    book.addWorksheet('Employees').addRow(EMPLOYEE_COLUMNS.map((column) => column.header));
    const pay = book.addWorksheet('Pay components');
    pay.addRow(PAY_COLUMNS.map((column) => column.header));
    pay.addRow(['IN-1', 'hra', 25000, 'INR', 'monthly', new Date(Date.UTC(2026, 9, 1))]);
    const { app } = await createTestApp();

    const response = await request(app)
      .post('/api/imports/validate')
      .set('Cookie', globalCookie)
      .set('X-Requested-With', 'fetch')
      .attach('file', Buffer.from(await book.xlsx.writeBuffer()), 'salary.xlsx');

    expect(response.status).toBe(200);
    expect(importSummarySchema.parse(response.body)).toMatchObject({
      valid: true,
      pay: { changed: 1, unchanged: 0 },
      changes: [
        { employeeCode: 'IN-1', action: 'pay', details: 'House rent allowance from 2026-10-01' },
      ],
    });
  });

  it('treats rows for another country as problems for a country HR user', async () => {
    const body = await validate(
      `${EMPLOYEE_HEADER}\r\nUS-2,Liam,Brown,liam@example.com,Account Executive,,Sales,US,Texas,full_time,1,2026-01-05,active,,exempt,,,\r\n`,
      { cookie: indiaCookie },
    );

    expect(body.errors).toEqual([
      {
        sheet: 'Employees',
        row: 2,
        column: 'Country',
        message: 'You can only import employees in India',
      },
    ]);
  });

  it('does not tell a country HR user about employees outside their country', async () => {
    const body = await validate(
      `${PAY_HEADER}\r\nUS-1,base_salary,1.00,USD,yearly,2026-11-01\r\n`,
      {
        cookie: indiaCookie,
        name: 'pay.csv',
      },
    );

    expect(body.errors[0]?.message).toBe('No employee with the code US-1');
  });

  it('explains files it cannot read', async () => {
    const body = await validate('%PDF-1.4', { name: 'report.pdf' });

    expect(body).toMatchObject({
      valid: false,
      errors: [{ sheet: 'File', message: 'Choose an Excel (.xlsx) or CSV (.csv) file' }],
    });
  });

  describe('requests', () => {
    it('needs a file', async () => {
      const { app } = await createTestApp();
      const response = await request(app)
        .post('/api/imports/validate')
        .set('Cookie', globalCookie)
        .set('X-Requested-With', 'fetch');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ detail: 'Choose a file to import' });
    });

    it('refuses files over 10 MB', async () => {
      const { app } = await createTestApp();
      const response = await request(app)
        .post('/api/imports/validate')
        .set('Cookie', globalCookie)
        .set('X-Requested-With', 'fetch')
        .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1, 'a'), 'big.csv');

      expect(response.status).toBe(413);
      expect(response.body).toMatchObject({ detail: 'Choose a file of at most 10 MB' });
    });

    it('only accepts uploads from the app, which sends a request header', async () => {
      const { app } = await createTestApp();
      const response = await request(app)
        .post('/api/imports/validate')
        .set('Cookie', globalCookie)
        .attach('file', Buffer.from(EMPLOYEE_HEADER), 'employees.csv');

      expect(response.status).toBe(403);
    });

    it('needs a signed-in user', async () => {
      const { app } = await createTestApp();
      const response = await request(app)
        .post('/api/imports/validate')
        .set('X-Requested-With', 'fetch');

      expect(response.status).toBe(401);
    });
  });
});

describe('GET /api/imports/template', () => {
  let cookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    cookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
  });

  it('downloads an empty CSV file for one dataset', async () => {
    const { app } = await createTestApp();
    const response = await request(app)
      .get('/api/imports/template')
      .query({ format: 'csv', dataset: 'pay' })
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="acme-pay-components-template.csv"',
    );
    expect(parseCsv(response.text.slice(1))).toEqual([PAY_COLUMNS.map((column) => column.header)]);
  });

  it('downloads an empty Excel file with both sheets', async () => {
    const { app } = await createTestApp();
    const response = await request(app)
      .get('/api/imports/template')
      .query({ format: 'xlsx' })
      .set('Cookie', cookie)
      .responseType('blob');

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="acme-import-template.xlsx"',
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Uint8Array.from(response.body as Buffer).buffer);
    expect(book.worksheets.map((sheet) => [sheet.name, sheet.rowCount])).toEqual([
      ['Employees', 1],
      ['Pay components', 1],
    ]);
  });
});
