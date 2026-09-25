import { useState } from 'react';
import { errorMessage } from '../api/errors.ts';
import { Alert } from '../components/ui/alert.tsx';
import { Button, ButtonLink } from '../components/ui/button.tsx';
import { Label } from '../components/ui/label.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.tsx';
import { formatRateDate } from '../currency/rates.ts';
import { DirectoryFilters } from '../employees/DirectoryFilters.tsx';
import { EmployeeTable } from '../employees/EmployeeTable.tsx';
import { ExportMenu } from '../employees/ExportMenu.tsx';
import { useEmployeeList } from '../employees/api.ts';
import { useDirectoryQuery } from '../employees/useDirectoryQuery.ts';

const numberFormat = new Intl.NumberFormat('en-US');

/** Search, filter, sort and page through the employees in the user's scope (HLD 3.1). */
export function EmployeesPage() {
  const { query, update, clear, hasFilters } = useDirectoryQuery();
  const list = useEmployeeList(query);
  const data = list.data;
  // Remounting the filters on clear empties the search box too.
  const [filtersKey, setFiltersKey] = useState(0);
  const clearFilters = () => {
    clear();
    setFiltersKey((key) => key + 1);
  };
  const first = data?.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.page * data.pageSize, data.total) : 0;
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  // The pager follows the URL, so it is right even while the next page is loading.

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <div className="flex items-center gap-2">
          <ExportMenu query={query} />
          <ButtonLink to="/employees/new">Add employee</ButtonLink>
        </div>
      </div>
      <div className="mt-4">
        <DirectoryFilters
          key={filtersKey}
          query={query}
          update={update}
          clear={clearFilters}
          hasFilters={hasFilters}
        />
      </div>

      {list.isError && <Alert className="mt-6">{errorMessage(list.error)}</Alert>}
      {list.isPending && <p className="mt-6 text-sm text-muted-foreground">Loading employees...</p>}

      {data?.total === 0 && (
        <div className="mt-6 rounded-lg border p-6 text-sm">
          <p>No employees match these filters.</p>
          {hasFilters && (
            <Button size="sm" variant="secondary" className="mt-2" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}

      {data && data.total > 0 && (
        <div className={list.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <div className="mt-6 mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>
              Showing {numberFormat.format(first)} to {numberFormat.format(last)} of{' '}
              {numberFormat.format(data.total)}
            </p>
            {data.rateDate && (
              <p className="text-muted-foreground">
                US dollars at rates of {formatRateDate(data.rateDate)}
              </p>
            )}
          </div>
          <EmployeeTable
            items={data.items}
            sort={query.sort}
            onSort={(sort) => {
              update({ sort });
            }}
          />
          <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Label htmlFor="rows-per-page" className="font-normal">
                Rows per page
              </Label>
              <Select
                value={String(query.pageSize)}
                onValueChange={(pageSize) => {
                  update({ pageSize });
                }}
              >
                <SelectTrigger id="rows-per-page" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['25', '50', '100'].map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span>
                Page {query.page} of {numberFormat.format(lastPage)}
              </span>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Previous page"
                disabled={query.page <= 1}
                onClick={() => {
                  update({ page: query.page - 1 });
                }}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Next page"
                disabled={query.page >= lastPage}
                onClick={() => {
                  update({ page: query.page + 1 });
                }}
              >
                Next
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
