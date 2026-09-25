import { describe, expect, it } from 'vitest';
import { CSV_BOM, csvLine, escapeFormula } from './csv.ts';

describe('escapeFormula', () => {
  it('puts an apostrophe before text that a spreadsheet would read as a formula', () => {
    for (const text of ['=1+1', '+44 20', '-5', '@SUM(A1)', '\tcmd', '\rcmd']) {
      expect(escapeFormula(text)).toBe(`'${text}`);
    }
  });

  it('leaves other text as it is', () => {
    for (const text of ['Priya', 'Software Engineer', "O'Neil", '1+1=2', 'a-b', '']) {
      expect(escapeFormula(text)).toBe(text);
    }
  });
});

describe('csvLine', () => {
  const columns = [
    { key: 'name', kind: 'text' },
    { key: 'amount', kind: 'amount' },
    { key: 'hired', kind: 'date' },
  ] as const;

  it('writes one line with CRLF, and empty cells for missing values', () => {
    expect(csvLine(columns, { name: 'Priya', amount: '50000.00', hired: null })).toBe(
      'Priya,50000.00,\r\n',
    );
  });

  it('escapes formulas in text cells', () => {
    expect(csvLine(columns, { name: '=HYPERLINK("x")', amount: '1.00', hired: '2025-01-01' })).toBe(
      `"'=HYPERLINK(""x"")",1.00,2025-01-01\r\n`,
    );
  });

  it('quotes cells with commas, quotes or line breaks, doubling quotes', () => {
    expect(
      csvLine(columns, { name: 'Sharma, Priya "PS"\nMumbai', amount: '1.00', hired: null }),
    ).toBe('"Sharma, Priya ""PS""\nMumbai",1.00,\r\n');
  });

  it('writes the header row from plain text', () => {
    expect(csvLine(columns, { name: 'Name', amount: 'Amount', hired: 'Hire date' })).toBe(
      'Name,Amount,Hire date\r\n',
    );
  });

  it('starts files with a byte order mark so Excel reads UTF-8', () => {
    expect(CSV_BOM).toBe('﻿');
  });
});
