import { EMPLOYMENT_TYPES, type EmployeeListQuery } from '@salary/shared';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '../auth/session.ts';
import { SelectField } from '../components/select-field.tsx';
import { TextField } from '../components/text-field.tsx';
import { Button } from '../components/ui/button.tsx';
import { useReferenceData } from './api.ts';
import { EMPLOYMENT_TYPE_LABELS } from './labels.ts';
import type { DirectoryKey } from './useDirectoryQuery.ts';

const asOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

/**
 * Filters for the directory; every change goes into the URL. The search box starts from the URL;
 * the page remounts this component when filters are cleared.
 */
export function DirectoryFilters({
  query,
  update,
  clear,
  hasFilters,
}: {
  query: EmployeeListQuery;
  update: (patch: Partial<Record<DirectoryKey, string | boolean | undefined>>) => void;
  clear: () => void;
  hasFilters: boolean;
}) {
  const { data: user } = useCurrentUser();
  const reference = useReferenceData();
  const [search, setSearch] = useState(query.search ?? '');

  // Search after a short pause in typing, so each keystroke is not a request.
  useEffect(() => {
    if (search.trim() === (query.search ?? '')) return;
    const timer = setTimeout(() => {
      update({ search: search.trim() });
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [search, query.search, update]);

  const regions = (reference.data?.regions ?? []).filter(
    (region) => !query.country || region.countryCode === query.country,
  );

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
      <TextField
        id="directory-search"
        label="Search"
        type="search"
        placeholder="Name or employee code"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
        }}
      />
      {user?.role === 'global_hr' && (
        <SelectField
          id="directory-country"
          label="Country"
          emptyLabel="All countries"
          value={query.country ?? ''}
          onValueChange={(country) => {
            update({ country, region: undefined });
          }}
          options={(reference.data?.countries ?? []).map((country) => ({
            value: country.code,
            label: country.name,
          }))}
        />
      )}
      <SelectField
        id="directory-region"
        label="Region"
        emptyLabel="All regions"
        value={query.region ?? ''}
        onValueChange={(region) => {
          update({ region });
        }}
        options={asOptions([...new Set(regions.map((region) => region.name))])}
      />
      <SelectField
        id="directory-department"
        label="Department"
        emptyLabel="All departments"
        value={query.department ?? ''}
        onValueChange={(department) => {
          update({ department });
        }}
        options={asOptions(reference.data?.departments ?? [])}
      />
      <SelectField
        id="directory-job-title"
        label="Job title"
        emptyLabel="All job titles"
        value={query.jobTitle ?? ''}
        onValueChange={(jobTitle) => {
          update({ jobTitle });
        }}
        options={asOptions(reference.data?.jobTitles ?? [])}
      />
      <SelectField
        id="directory-employment-type"
        label="Employment type"
        emptyLabel="All types"
        value={query.employmentType ?? ''}
        onValueChange={(employmentType) => {
          update({ employmentType });
        }}
        options={EMPLOYMENT_TYPES.map((type) => ({
          value: type,
          label: EMPLOYMENT_TYPE_LABELS[type],
        }))}
      />
      <div className="flex items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={query.includeInactive}
            onChange={(event) => {
              update({ includeInactive: event.target.checked });
            }}
          />
          Include inactive employees
        </label>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clear}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
