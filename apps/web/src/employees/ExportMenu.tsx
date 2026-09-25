import type { EmployeeListQuery, ExportFormat, SpreadsheetDataset } from '@salary/shared';
import { Button } from '../components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu.tsx';

const FILTER_KEYS = [
  'search',
  'country',
  'region',
  'department',
  'jobTitle',
  'employmentType',
] as const;

/** The export link for a format and dataset, with the directory's filters (not sort or page). */
export function exportHref(
  query: EmployeeListQuery,
  format: ExportFormat,
  dataset?: SpreadsheetDataset,
): string {
  const params = new URLSearchParams({ format });
  if (dataset) params.set('dataset', dataset);
  for (const key of FILTER_KEYS) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  if (query.includeInactive) params.set('includeInactive', 'true');
  return `/api/exports?${params.toString()}`;
}

const OPTIONS: { label: string; format: ExportFormat; dataset?: SpreadsheetDataset }[] = [
  { label: 'Excel: employees and pay', format: 'xlsx' },
  { label: 'CSV: employees', format: 'csv', dataset: 'employees' },
  { label: 'CSV: pay components', format: 'csv', dataset: 'pay' },
];

/**
 * Downloads the employees matching the directory filters, and their current pay, in the columns
 * import reads. The API streams the file, so a plain link is enough; the session cookie goes
 * with it on the same origin.
 */
export function ExportMenu({ query }: { query: EmployeeListQuery }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {OPTIONS.map((option) => (
          <DropdownMenuItem key={option.label} asChild>
            <a href={exportHref(query, option.format, option.dataset)} download>
              {option.label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
