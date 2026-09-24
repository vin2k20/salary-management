import {
  countryName,
  formatMoney,
  type EmployeeListItem,
  type EmployeeSortField,
} from '@salary/shared';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { cn } from '../lib/cn.ts';
import { EMPLOYMENT_TYPE_LABELS } from './labels.ts';

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, EmployeeListItem>();

/** Columns; `sort` names the API sort field for columns that can be sorted. */
const columns = helper.columns([
  helper.display({
    id: 'name',
    header: 'Employee',
    meta: { sort: 'name', align: 'left' },
    cell: ({ row }) => (
      <>
        <div className="font-medium">
          {row.original.firstName} {row.original.lastName}
        </div>
        <div className="text-muted-foreground">{row.original.employeeCode}</div>
      </>
    ),
  }),
  helper.accessor('jobTitle', { header: 'Job title', meta: { sort: 'jobTitle', align: 'left' } }),
  helper.accessor('department', {
    header: 'Department',
    meta: { sort: 'department', align: 'left' },
  }),
  helper.display({
    id: 'location',
    header: 'Location',
    meta: { sort: 'country', align: 'left' },
    cell: ({ row }) => `${row.original.region}, ${countryName(row.original.countryCode)}`,
  }),
  helper.display({
    id: 'type',
    header: 'Type',
    meta: { align: 'left' },
    cell: ({ row }) => (
      <>
        {EMPLOYMENT_TYPE_LABELS[row.original.employmentType]}
        {row.original.status === 'inactive' && (
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Inactive
          </span>
        )}
      </>
    ),
  }),
  helper.display({
    id: 'annualTotal',
    header: 'Annual total',
    meta: { sort: 'annualTotal', align: 'right' },
    cell: ({ row }) =>
      formatMoney(row.original.annualTotal.amountMinor, row.original.annualTotal.currency),
  }),
  helper.display({
    id: 'monthlyTotal',
    header: 'Monthly',
    meta: { align: 'right' },
    cell: ({ row }) =>
      formatMoney(row.original.monthlyTotal.amountMinor, row.original.monthlyTotal.currency),
  }),
]);

interface ColumnMeta {
  sort?: EmployeeSortField;
  align: 'left' | 'right';
}

/**
 * The directory table. Rows arrive sorted and paged by the API; a sortable heading asks for
 * ascending order first, then descending.
 */
export function EmployeeTable({
  items,
  sort,
  onSort,
}: {
  items: EmployeeListItem[];
  sort: string;
  onSort: (sort: string) => void;
}) {
  const table = useTable({ features, columns, data: items });
  const descending = sort.startsWith('-');
  const sortField = descending ? sort.slice(1) : sort;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta as ColumnMeta;
                const active = meta.sort !== undefined && meta.sort === sortField;
                let ariaSort: 'ascending' | 'descending' | 'none' | undefined;
                if (meta.sort !== undefined) {
                  ariaSort = active ? (descending ? 'descending' : 'ascending') : 'none';
                }
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      'px-4 py-2 font-medium',
                      meta.align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {meta.sort === undefined ? (
                      <table.FlexRender header={header} />
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => {
                          const field = meta.sort ?? 'name';
                          onSort(active && !descending ? `-${field}` : field);
                        }}
                      >
                        <table.FlexRender header={header} />
                        <span aria-hidden="true">{active ? (descending ? '↓' : '↑') : ''}</span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t">
              {row.getAllCells().map((cell) => {
                const meta = cell.column.columnDef.meta as ColumnMeta;
                return (
                  <td
                    key={cell.id}
                    className={cn(
                      'px-4 py-2 align-top',
                      meta.align === 'right' && 'text-right tabular-nums',
                    )}
                  >
                    <table.FlexRender cell={cell} />
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
