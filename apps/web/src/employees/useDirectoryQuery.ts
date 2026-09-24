import { employeeListQuerySchema, type EmployeeListQuery } from '@salary/shared';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useDisplayCurrency } from '../currency/useDisplayCurrency.ts';

/** URL parameters the directory owns; `currency` belongs to the header toggle. */
const DIRECTORY_KEYS = [
  'search',
  'country',
  'region',
  'department',
  'jobTitle',
  'employmentType',
  'includeInactive',
  'sort',
  'page',
  'pageSize',
] as const;

export type DirectoryKey = (typeof DIRECTORY_KEYS)[number];

const defaults = employeeListQuerySchema.parse({});

/**
 * The directory query, read from the URL with the same schema the API uses, so a bookmarked or
 * shared link always shows the same view. Default values are left out of the URL.
 */
export function useDirectoryQuery() {
  const [params, setParams] = useSearchParams();
  const [currency] = useDisplayCurrency();

  const raw = Object.fromEntries(DIRECTORY_KEYS.map((key) => [key, params.get(key) ?? undefined]));
  const parsed = employeeListQuerySchema.safeParse({ ...raw, currency });
  const query: EmployeeListQuery = parsed.success
    ? parsed.data
    : employeeListQuerySchema.parse({ currency });

  /** Changes some parameters; a change to anything but the page starts again from page 1. */
  const update = useCallback(
    (patch: Partial<Record<DirectoryKey, string | number | boolean | undefined>>) => {
      setParams((next) => {
        // Object.entries drops `undefined` from the value type, but callers pass it to clear a key.
        const entries = Object.entries(patch) as [
          DirectoryKey,
          string | number | boolean | undefined,
        ][];
        for (const [key, value] of entries) {
          const text = value === undefined || value === false ? '' : String(value);
          const defaultText = String(defaults[key as keyof EmployeeListQuery] ?? '');
          if (text === '' || text === defaultText) next.delete(key);
          else next.set(key, text);
        }
        if (!('page' in patch)) next.delete('page');
        return next;
      });
    },
    [setParams],
  );

  /** Removes every filter, keeping only the currency choice. */
  const clear = useCallback(() => {
    setParams((next) => {
      for (const key of DIRECTORY_KEYS) next.delete(key);
      return next;
    });
  }, [setParams]);

  const hasFilters =
    query.includeInactive ||
    [
      query.search,
      query.country,
      query.region,
      query.department,
      query.jobTitle,
      query.employmentType,
    ].some((value) => value !== undefined);

  return { query, update, clear, hasFilters };
}
