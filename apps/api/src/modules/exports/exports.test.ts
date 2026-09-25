import { EMPLOYEE_COLUMNS, PAY_COLUMNS, exportQuerySchema } from '@salary/shared';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { parseCsv } from '../../test/csv.ts';
import { insertExportData } from '../../test/export-data.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';
import { employeeRowBatches, payRowBatches } from './exports.service.ts';

const EMPLOYEE_HEADERS = EMPLOYEE_COLUMNS.map((column) => column.header);
const PAY_HEADERS = PAY_COLUMNS.map((column) => column.header);

describe('GET /api/exports', () => {
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

  async function exportFile(query: Record<string, string>, cookie = globalCookie) {
    const { app } = await createTestApp();
    return request(app).get('/api/exports').query(query).set('Cookie', cookie).responseType('blob');
  }

  async function csv(query: Record<string, string>, cookie = globalCookie) {
    const response = await exportFile({ format: 'csv', ...query }, cookie);
    expect(response.status).toBe(200);
    const text = (response.body as Buffer).toString('utf8');
    expect(text.startsWith('﻿')).toBe(true);
    return { response, rows: parseCsv(text.slice(1)) };
  }

  const codes = (rows: string[][]) => rows.slice(1).map((row) => row[0]);

  describe('CSV', () => {
    it('downloads active employees in the import columns, by employee code', async () => {
      const { response, rows } = await csv({});

      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="acme-employees-2026-09-24.csv"',
      );
      expect(response.headers['cache-control']).toBe('no-store');
      expect(rows[0]).toEqual(EMPLOYEE_HEADERS);
      expect(codes(rows)).toEqual(['CA-1', 'IN-1', 'US-1']);
      expect(rows[2]).toEqual([
        'IN-1',
        'Aarav',
        'Sharma',
        'aarav.sharma@example.com',
        'Software Engineer',
        'L2',
        'Engineering',
        'IN',
        'Karnataka',
        'full_time',
        '1',
        '2025-01-01',
        'active',
        '',
        '',
        '',
        'yes',
        'no',
      ]);
    });

    it('escapes text that would run as a formula, and quotes commas', async () => {
      const { rows } = await csv({ country: 'US' });

      expect(rows[1]).toEqual(
        expect.arrayContaining(['Stone, Jr.', `'=HYPERLINK("http://example.com")`, 'exempt']),
      );
    });

    it('downloads current pay per component, leaving out ended and scheduled items', async () => {
      const { response, rows } = await csv({ dataset: 'pay' });

      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="acme-pay-components-2026-09-24.csv"',
      );
      expect(rows).toEqual([
        PAY_HEADERS,
        ['CA-1', 'base_salary', '4000.00', 'CAD', 'bi_weekly', '2025-01-01'],
        ['IN-1', 'basic', '50000.00', 'INR', 'monthly', '2025-01-01'],
        ['IN-1', 'hra', '20000.50', 'INR', 'monthly', '2025-01-01'],
        ['US-1', 'base_salary', '120000.00', 'USD', 'yearly', '2025-01-01'],
      ]);
    });

    it('follows the directory filters, including inactive employees when asked', async () => {
      expect(codes((await csv({ country: 'IN', includeInactive: 'true' })).rows)).toEqual([
        'IN-1',
        'IN-2',
      ]);
      expect(codes((await csv({ department: 'Engineering', search: 'stone' })).rows)).toEqual([
        'US-1',
      ]);
      expect(codes((await csv({ dataset: 'pay', employmentType: 'part_time' })).rows)).toEqual([]);

      const inactive = (await csv({ country: 'IN', includeInactive: 'true' })).rows[2];
      expect(inactive?.slice(9, 14)).toEqual([
        'part_time',
        '0.5',
        '2025-01-01',
        'inactive',
        '2026-06-30',
      ]);
    });

    it('keeps a country HR user to their own country, even when asking for another', async () => {
      expect(codes((await csv({}, indiaCookie)).rows)).toEqual(['IN-1']);
      expect((await csv({ country: 'US', dataset: 'pay' }, indiaCookie)).rows).toEqual([
        PAY_HEADERS,
      ]);
    });
  });

  describe('Excel', () => {
    async function workbook(query: Record<string, string>, cookie = globalCookie) {
      const response = await exportFile({ format: 'xlsx', ...query }, cookie);
      expect(response.status).toBe(200);
      const book = new ExcelJS.Workbook();
      // ExcelJS takes the bytes as an ArrayBuffer.
      await book.xlsx.load(Uint8Array.from(response.body as Buffer).buffer);
      return { response, book };
    }

    function values(sheet: ExcelJS.Worksheet) {
      const rows: unknown[][] = [];
      sheet.eachRow((row) => {
        rows.push(EMPLOYEE_HEADERS.map((_, index) => row.getCell(index + 1).value));
      });
      return rows;
    }

    it('holds employees and pay components as two sheets with typed cells', async () => {
      const { response, book } = await workbook({ country: 'US' });

      expect(response.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="acme-salary-data-2026-09-24.xlsx"',
      );
      expect(book.worksheets.map((sheet) => sheet.name)).toEqual(['Employees', 'Pay components']);

      const [employees, pay] = book.worksheets;
      if (!employees || !pay) throw new Error('Missing sheets');
      expect(values(employees)[0]).toEqual(EMPLOYEE_HEADERS);
      const title = employees.getRow(2).getCell(5);
      // A typed text cell: Excel shows the text and never runs it as a formula.
      expect(title.type).toBe(ExcelJS.ValueType.String);
      expect(title.value).toBe('=HYPERLINK("http://example.com")');
      expect(employees.getRow(2).getCell(11).value).toBe(1);
      expect(employees.getRow(2).getCell(12).value).toBe('2025-01-01');

      const amount = pay.getRow(2).getCell(3);
      expect(pay.getRow(1).values).toEqual([undefined, ...PAY_HEADERS]);
      expect(amount.value).toBe(120000);
      expect(amount.numFmt).toBe('0.00');
    });

    it('writes amounts with their minor units and follows the scope', async () => {
      const { book } = await workbook({}, indiaCookie);

      const pay = book.getWorksheet('Pay components');
      expect(pay?.rowCount).toBe(3);
      expect(pay?.getRow(3).values).toEqual([
        undefined,
        'IN-1',
        'hra',
        20000.5,
        'INR',
        'monthly',
        '2025-01-01',
      ]);
      expect(book.getWorksheet('Employees')?.rowCount).toBe(2);
    });
  });

  describe('batches', () => {
    it('reads employees and their pay a few at a time, so memory stays flat', async () => {
      const { db } = await sharedTestDatabase();
      const filters = exportQuerySchema.parse({ format: 'csv' });
      const employees: string[][] = [];
      for await (const batch of employeeRowBatches(db, { kind: 'all' }, filters, 2)) {
        employees.push(batch.map((row) => row.employeeCode ?? ''));
      }
      const pay: string[][] = [];
      for await (const batch of payRowBatches(db, { kind: 'all' }, filters, '2026-09-24', 2)) {
        pay.push(batch.map((row) => `${row.employeeCode ?? ''} ${row.componentCode ?? ''}`));
      }

      expect(employees).toEqual([['CA-1', 'IN-1'], ['US-1']]);
      expect(pay).toEqual([['CA-1 base_salary', 'IN-1 basic', 'IN-1 hra'], ['US-1 base_salary']]);
    });
  });

  describe('requests', () => {
    it('needs a format', async () => {
      const response = await exportFile({});

      expect(response.status).toBe(400);
    });

    it('needs a signed-in user', async () => {
      const { app } = await createTestApp();

      expect((await request(app).get('/api/exports').query({ format: 'csv' })).status).toBe(401);
    });
  });
});
