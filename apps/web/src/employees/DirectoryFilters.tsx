import { EMPLOYMENT_TYPES, type EmployeeListQuery } from '@salary/shared';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '../auth/session.ts';
import { SelectField } from '../components/select-field.tsx';
import { TextField } from '../components/text-field.tsx';
import { Button } from '../components/ui/button.tsx';
import { useReferenceData } from './api.ts';
import { EMPLOYMENT_TYPE_LABELS } from './labels.ts';
import type { DirectoryKey } from './useDirectoryQuery.ts';

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
          value={query.country ?? ''}
          onChange={(event) => {
            update({ country: event.target.value, region: undefined });
          }}
        >
          <option value="">All countries</option>
          {reference.data?.countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </SelectField>
      )}
      <SelectField
        id="directory-region"
        label="Region"
        value={query.region ?? ''}
        onChange={(event) => {
          update({ region: event.target.value });
        }}
      >
        <option value="">All regions</option>
        {regions.map((region) => (
          <option key={`${region.countryCode}-${region.name}`} value={region.name}>
            {region.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="directory-department"
        label="Department"
        value={query.department ?? ''}
        onChange={(event) => {
          update({ department: event.target.value });
        }}
      >
        <option value="">All departments</option>
        {reference.data?.departments.map((department) => (
          <option key={department} value={department}>
            {department}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="directory-job-title"
        label="Job title"
        value={query.jobTitle ?? ''}
        onChange={(event) => {
          update({ jobTitle: event.target.value });
        }}
      >
        <option value="">All job titles</option>
        {reference.data?.jobTitles.map((title) => (
          <option key={title} value={title}>
            {title}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="directory-employment-type"
        label="Employment type"
        value={query.employmentType ?? ''}
        onChange={(event) => {
          update({ employmentType: event.target.value });
        }}
      >
        <option value="">All types</option>
        {EMPLOYMENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {EMPLOYMENT_TYPE_LABELS[type]}
          </option>
        ))}
      </SelectField>
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
