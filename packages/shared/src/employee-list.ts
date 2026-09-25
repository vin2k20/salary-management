import { z } from 'zod';
import { COUNTRIES, countryCodeSchema, type CountryCode } from './countries.ts';
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from './employees.ts';
import { displayCurrencySchema } from './fx-rates.ts';
import { CURRENCY_CODES, type CurrencyCode } from './money.ts';
import { booleanParam, optionalParam, optionalTextParam } from './query-params.ts';

export const EMPLOYEE_SORT_FIELDS = [
  'name',
  'employeeCode',
  'jobTitle',
  'department',
  'country',
  'hireDate',
  'annualTotal',
] as const;

export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

/**
 * Filters, sorting and paging for the employee directory. The same schema reads the API query
 * and the web app's URL, so a bookmarked view always means the same thing.
 */
export const employeeListQuerySchema = z.object({
  search: optionalTextParam,
  country: optionalParam(countryCodeSchema),
  region: optionalTextParam,
  department: optionalTextParam,
  jobTitle: optionalTextParam,
  employmentType: optionalParam(z.enum(EMPLOYMENT_TYPES)),
  includeInactive: booleanParam,
  /** A field name, with a leading "-" for descending order. */
  sort: z
    .string()
    .regex(new RegExp(`^-?(${EMPLOYEE_SORT_FIELDS.join('|')})$`), 'Unknown sort field')
    .default('name'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  currency: optionalParam(displayCurrencySchema).default('local'),
});

export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;

const currencyCodeSchema = z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]]);

export const moneySchema = z.object({
  amountMinor: z.number().int(),
  currency: currencyCodeSchema,
});

export type Money = z.infer<typeof moneySchema>;

export const employeeListItemSchema = z.object({
  id: z.uuid(),
  employeeCode: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  jobTitle: z.string(),
  department: z.string(),
  countryCode: countryCodeSchema,
  region: z.string(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  status: z.enum(EMPLOYEE_STATUSES),
  annualTotal: moneySchema,
  /** Annual total / 12, rounded once. */
  monthlyTotal: moneySchema,
});

export type EmployeeListItem = z.infer<typeof employeeListItemSchema>;

export const employeeListResponseSchema = z.object({
  items: z.array(employeeListItemSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  currency: displayCurrencySchema,
  /** Date of the exchange rates used, when amounts are in US dollars. */
  rateDate: z.iso.date().nullable(),
});

export type EmployeeListResponse = z.infer<typeof employeeListResponseSchema>;

/** Filter choices within the user's scope. */
export const referenceDataSchema = z.object({
  countries: z.array(
    z.object({ code: countryCodeSchema, name: z.string(), currencyCode: currencyCodeSchema }),
  ),
  regions: z.array(z.object({ countryCode: countryCodeSchema, name: z.string() })),
  departments: z.array(z.string()),
  jobTitles: z.array(z.string()),
  employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES)),
});

export type ReferenceData = z.infer<typeof referenceDataSchema>;

export function countryName(code: CountryCode): string {
  return COUNTRIES[code].name;
}
