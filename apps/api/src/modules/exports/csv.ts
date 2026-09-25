import type { CellKind } from '@salary/shared';

/** Excel reads a CSV file as UTF-8 (₹, é) only when it starts with a byte order mark. */
export const CSV_BOM = '﻿';

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Text that a spreadsheet would run as a formula gets a leading apostrophe, so an exported file
 * cannot run formulas when opened (HLD 7). Import removes it again.
 */
export function escapeFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

const NEEDS_QUOTES = /[",\r\n]/;

function field(value: string | null, kind: CellKind): string {
  if (value === null) return '';
  // Amounts and decimals are written by the API as plain numbers, never as formulas.
  const text = kind === 'amount' || kind === 'decimal' ? value : escapeFormula(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One CSV line (RFC 4180) for a row, in column order, ending with CRLF. */
export function csvLine<Key extends string>(
  columns: readonly { key: Key; kind: CellKind }[],
  row: Record<Key, string | null>,
): string {
  return `${columns.map((column) => field(row[column.key], column.kind)).join(',')}\r\n`;
}
