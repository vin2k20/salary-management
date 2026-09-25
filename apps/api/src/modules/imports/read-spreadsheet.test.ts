import { EMPLOYEE_COLUMNS, PAY_COLUMNS } from '@salary/shared';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { readSpreadsheet } from './read-spreadsheet.ts';

const PAY_HEADER = PAY_COLUMNS.map((column) => column.header).join(',');

function csvFile(text: string, name = 'pay.csv') {
  return { name, buffer: Buffer.from(`\uFEFF${text}`, 'utf8') };
}

async function xlsxFile(build: (book: ExcelJS.Workbook) => void, name = 'data.xlsx') {
  const book = new ExcelJS.Workbook();
  build(book);
  return { name, buffer: Buffer.from(await book.xlsx.writeBuffer()) };
}

describe('readSpreadsheet with CSV', () => {
  it('reads rows by column, numbered as in the spreadsheet, skipping empty rows', async () => {
    const result = await readSpreadsheet(
      csvFile(
        `${PAY_HEADER}\r\nIN-1,basic,50000.00,INR,monthly,2025-01-01\r\n,,,,,\r\n"IN-2",hra,"1,000.50",INR,monthly,2025-01-01\r\n`,
      ),
    );

    expect(result.errors).toEqual([]);
    expect(result.sheets).toEqual([
      {
        dataset: 'pay',
        sheet: 'Pay components',
        rows: [
          {
            row: 2,
            cells: {
              employeeCode: 'IN-1',
              componentCode: 'basic',
              amount: '50000.00',
              currency: 'INR',
              frequency: 'monthly',
              effectiveFrom: '2025-01-01',
            },
          },
          {
            row: 4,
            cells: {
              employeeCode: 'IN-2',
              componentCode: 'hra',
              amount: '1,000.50',
              currency: 'INR',
              frequency: 'monthly',
              effectiveFrom: '2025-01-01',
            },
          },
        ],
      },
    ]);
  });

  it('knows an employee file by its columns, in any order and case', async () => {
    const headers = [...EMPLOYEE_COLUMNS].reverse().map((column) => column.header.toUpperCase());
    const result = await readSpreadsheet(csvFile(`${headers.join(',')}\r\n`, 'people.CSV'));

    expect(result.errors).toEqual([]);
    expect(result.sheets[0]).toMatchObject({ dataset: 'employees', sheet: 'Employees', rows: [] });
  });

  it('removes the apostrophe that export puts before formula characters', async () => {
    const result = await readSpreadsheet(
      csvFile(`${PAY_HEADER}\r\n'=IN-1,'+basic,'hello,1.00,INR,monthly,2025-01-01\r\n`),
    );

    expect(result.sheets[0]?.rows[0]?.cells).toMatchObject({
      employeeCode: '=IN-1',
      componentCode: '+basic',
      amount: "'hello",
    });
  });

  it('names the columns that are missing', async () => {
    const result = await readSpreadsheet(
      csvFile('Employee code,Component code,Amount,Frequency\r\n'),
    );

    expect(result.sheets).toEqual([]);
    expect(result.errors).toEqual([
      {
        sheet: 'Pay components',
        row: null,
        column: 'Currency',
        message: 'Add the Currency column',
      },
      {
        sheet: 'Pay components',
        row: null,
        column: 'Effective from',
        message: 'Add the Effective from column',
      },
    ]);
  });

  it('limits the number of rows in a file', async () => {
    const line = 'IN-1,basic,1.00,INR,monthly,2025-01-01\r\n';
    const result = await readSpreadsheet(csvFile(`${PAY_HEADER}\r\n${line}${line}`), {
      maxRows: 1,
    });

    expect(result.sheets).toEqual([]);
    expect(result.errors[0]?.message).toBe('Use at most 1 rows in one file');
  });

  it('refuses files it cannot read', async () => {
    const unknown = await readSpreadsheet(csvFile('Name,Salary\r\nPriya,100\r\n'));
    expect(unknown.errors).toEqual([
      {
        sheet: 'File',
        row: null,
        column: null,
        message: 'The columns do not match the employee or pay component template',
      },
    ]);

    const latin1 = await readSpreadsheet({ name: 'pay.csv', buffer: Buffer.from([0x41, 0xe9]) });
    expect(latin1.errors[0]?.message).toBe('Save the CSV file with UTF-8 encoding');

    const pdf = await readSpreadsheet({ name: 'pay.pdf', buffer: Buffer.from('%PDF') });
    expect(pdf.errors[0]?.message).toBe('Choose an Excel (.xlsx) or CSV (.csv) file');

    const fake = await readSpreadsheet({ name: 'pay.xlsx', buffer: Buffer.from('a,b\r\n') });
    expect(fake.errors[0]?.message).toBe('This is not an Excel (.xlsx) file');
  });
});

describe('readSpreadsheet with Excel', () => {
  it('reads both sheets with typed cells, links and dates', async () => {
    const file = await xlsxFile((book) => {
      const pay = book.addWorksheet('Pay components');
      pay.addRow(PAY_COLUMNS.map((column) => column.header));
      pay.addRow(['IN-1', 'basic', 50000, 'INR', 'monthly', new Date(Date.UTC(2025, 0, 1))]);
      const employees = book.addWorksheet('employees');
      employees.addRow(EMPLOYEE_COLUMNS.map((column) => column.header));
      const row = employees.addRow(['IN-1', 'Aarav', 'Sharma']);
      row.getCell(4).value = { text: 'aarav@example.com', hyperlink: 'mailto:aarav@example.com' };
      row.getCell(5).value = { richText: [{ text: 'Software ' }, { text: 'Engineer' }] };
      row.getCell(11).value = 0.5;
      row.getCell(17).value = true;
    });

    const result = await readSpreadsheet(file);

    expect(result.errors).toEqual([]);
    expect(result.sheets.map((sheet) => sheet.dataset)).toEqual(['employees', 'pay']);
    expect(result.sheets[0]?.rows[0]).toEqual({
      row: 2,
      cells: {
        employeeCode: 'IN-1',
        firstName: 'Aarav',
        lastName: 'Sharma',
        email: 'aarav@example.com',
        jobTitle: 'Software Engineer',
        fte: 0.5,
        pfApplicable: true,
      },
    });
    expect(result.sheets[1]?.rows[0]?.cells).toMatchObject({
      amount: 50000,
      effectiveFrom: new Date(Date.UTC(2025, 0, 1)),
    });
  });

  it('reports formulas and error values instead of guessing their values', async () => {
    const file = await xlsxFile((book) => {
      const pay = book.addWorksheet('Pay components');
      pay.addRow(PAY_COLUMNS.map((column) => column.header));
      const row = pay.addRow(['IN-1', 'basic']);
      row.getCell(3).value = { formula: '1000*12', result: 12000 };
      row.getCell(6).value = { error: '#N/A' };
    });

    const result = await readSpreadsheet(file);

    expect(result.errors).toEqual([
      {
        sheet: 'Pay components',
        row: 2,
        column: 'Amount',
        message: 'Replace the formula with its value',
      },
      {
        sheet: 'Pay components',
        row: 2,
        column: 'Effective from',
        message: 'Replace the error value #N/A',
      },
    ]);
  });

  it('keeps Excel files small, since they are read whole into memory', async () => {
    const file = await xlsxFile((book) => {
      const pay = book.addWorksheet('Pay components');
      pay.addRow(PAY_COLUMNS.map((column) => column.header));
      pay.addRow(['IN-1', 'basic', 1, 'INR', 'monthly', '2025-01-01']);
      pay.addRow(['IN-2', 'basic', 1, 'INR', 'monthly', '2025-01-01']);
    });

    const tooBig = await readSpreadsheet(file, { maxExcelBytes: 100, maxExcelRows: 20_000 });
    expect(tooBig.errors[0]?.message).toMatch(
      /^Excel files can be up to .+ MB \(about 20,000 rows\)\. Split the file, or save each sheet as a CSV file\.$/,
    );

    const tooLong = await readSpreadsheet(file, { maxExcelRows: 1 });
    expect(tooLong.errors[0]?.message).toBe('Use at most 1 rows in one file');
  });

  it('needs an Employees or Pay components sheet', async () => {
    const file = await xlsxFile((book) => {
      book.addWorksheet('Sheet1').addRow(['Name']);
    });

    const result = await readSpreadsheet(file);

    expect(result.errors).toEqual([
      {
        sheet: 'File',
        row: null,
        column: null,
        message: 'Add an Employees or Pay components sheet',
      },
    ]);
  });
});
