import type { ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

export interface StatColumn {
  header: string;
  /** Numbers line up on the right. */
  numeric?: boolean;
}

export interface StatRow {
  key: string;
  cells: ReactNode[];
}

/**
 * A plain table of figures: the first cell names the row, the rest are values. Every chart on the
 * dashboard has one, so each value can be read without the chart.
 */
export function StatTable({
  label,
  columns,
  rows,
  className,
}: {
  label: string;
  columns: StatColumn[];
  rows: StatRow[];
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border bg-card', className)}>
      <table aria-label={label} className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={cn('px-4 py-2 font-medium', column.numeric ? 'text-right' : 'text-left')}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t">
              {row.cells.map((cell, index) => {
                const numeric = columns[index]?.numeric === true;
                const className = cn(
                  'px-4 py-2',
                  numeric ? 'text-right tabular-nums whitespace-nowrap' : 'text-left',
                );
                return index === 0 ? (
                  <th key={index} scope="row" className={cn(className, 'font-normal')}>
                    {cell}
                  </th>
                ) : (
                  <td key={index} className={className}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
