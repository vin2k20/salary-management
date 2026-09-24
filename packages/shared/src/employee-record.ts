import { z } from 'zod';
import { emailSchema } from './auth.ts';
import { COUNTRIES, COUNTRY_CODES, countryCodeSchema, type CountryCode } from './countries.ts';
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from './employees.ts';
import { REGION_LABELS, REGIONS } from './regions.ts';

/** Overtime eligibility under the US Fair Labor Standards Act. */
export const FLSA_STATUSES = ['exempt', 'non_exempt'] as const;

export type FlsaStatus = (typeof FLSA_STATUSES)[number];

/**
 * Country-specific optional fields (research-country-pay-structures.md, section 2). Canada has
 * none beyond the province.
 */
export const COUNTRY_FIELD_KEYS = {
  US: ['flsaStatus'],
  CA: [],
  AU: ['award'],
  IN: ['pfApplicable', 'esiApplicable'],
} as const satisfies Record<CountryCode, readonly string[]>;

export type CountryFieldKey = (typeof COUNTRY_FIELD_KEYS)[CountryCode][number];

/**
 * Every country's fields; which ones an employee may have depends on their country. An empty
 * text box or a "not set" choice means the field has no value.
 */
export const countryFieldsSchema = z.object({
  flsaStatus: z
    .enum([...FLSA_STATUSES, ''], 'Choose exempt or non-exempt')
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  award: z
    .string()
    .trim()
    .max(200, 'Use at most 200 characters')
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  pfApplicable: z.boolean('Choose yes or no').optional(),
  esiApplicable: z.boolean('Choose yes or no').optional(),
});

export type CountryFields = z.infer<typeof countryFieldsSchema>;

/** Trimmed text with single spaces, so "Senior  Engineer " and "Senior Engineer" match. */
function tidyText(required: string, max = 100) {
  return z
    .string(required)
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(1, required)
        .max(max, `Use at most ${String(max)} characters`),
    );
}

const FTE_MESSAGE = 'Enter an FTE above 0 and up to 1';

const detailFields = {
  firstName: tidyText('Enter a first name'),
  lastName: tidyText('Enter a last name'),
  email: emailSchema,
  jobTitle: tidyText('Enter a job title'),
  jobLevel: z
    .string()
    .trim()
    .max(20, 'Use at most 20 characters')
    .nullish()
    .transform((value) => (value === '' || value === undefined ? null : value)),
  department: tidyText('Enter a department'),
  region: z.string('Choose a region').trim(),
  employmentType: z.enum(EMPLOYMENT_TYPES, 'Choose an employment type'),
  fte: z
    .number(FTE_MESSAGE)
    .gt(0, FTE_MESSAGE)
    .lte(1, FTE_MESSAGE)
    .refine(
      (value) => Number.isInteger(Math.round(value * 1e6) / 1e3),
      'Use at most three decimals',
    ),
  hireDate: z.iso.date('Enter a valid date'),
};

export interface DetailIssue {
  path: (string | number)[];
  message: string;
}

/**
 * Checks the fields that depend on the employee's country: the region must belong to it, and
 * only its own country-specific fields may be set. Used by the create schema and, on the merged
 * record, by the update service, since an update does not include the country.
 */
export function countryDetailIssues(value: {
  countryCode: CountryCode;
  region: string;
  countryFields: CountryFields;
}): DetailIssue[] {
  const issues: DetailIssue[] = [];
  const country = COUNTRIES[value.countryCode].name;
  if (!REGIONS[value.countryCode].includes(value.region)) {
    issues.push({
      path: ['region'],
      message: `Choose a ${REGION_LABELS[value.countryCode].toLowerCase()} in ${country}`,
    });
  }
  const allowed: readonly string[] = COUNTRY_FIELD_KEYS[value.countryCode];
  // A blank optional field parses to undefined and counts as not set.
  const fields: Record<string, unknown> = value.countryFields;
  for (const [key, fieldValue] of Object.entries(fields)) {
    if (fieldValue !== undefined && !allowed.includes(key)) {
      issues.push({
        path: ['countryFields', key],
        message: `Not used for employees in ${country}`,
      });
    }
  }
  return issues;
}

const COUNTRY_CHECK_FIELDS = ['countryCode', 'region', 'countryFields'];

/** A new employee. New employees are always active; the employee code is kept in upper case. */
export const createEmployeeRequestSchema = z
  .object({
    employeeCode: z
      .string('Enter an employee code')
      .trim()
      .toUpperCase()
      .min(1, 'Enter an employee code')
      .max(20, 'Use at most 20 characters')
      .regex(/^[A-Z0-9-]+$/, 'Use letters, digits and hyphens only'),
    ...detailFields,
    fte: detailFields.fte.default(1),
    countryCode: z.enum(COUNTRY_CODES as [CountryCode, ...CountryCode[]], 'Choose a country'),
    countryFields: countryFieldsSchema.default({}),
  })
  .superRefine(
    (value, context) => {
      for (const issue of countryDetailIssues(value)) {
        context.addIssue({ code: 'custom', ...issue });
      }
    },
    // Runs even when other fields are wrong, so a form shows every problem at once.
    {
      when: ({ issues }) =>
        !issues.some((issue) => COUNTRY_CHECK_FIELDS.includes(String(issue.path?.[0]))),
    },
  );

export type CreateEmployeeRequest = z.infer<typeof createEmployeeRequestSchema>;

/**
 * Changes to an employee's details, or marking them inactive or active again. The employee code
 * is fixed, as imports match on it, and a move to another country is its own action.
 */
export const updateEmployeeRequestSchema = z
  .object({
    ...detailFields,
    countryFields: countryFieldsSchema,
    status: z.enum(EMPLOYEE_STATUSES),
    inactiveOn: z.iso.date('Enter a valid date').nullable(),
  })
  .partial()
  // Fields left out of the request are absent from the parsed value.
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to change' });

export type UpdateEmployeeRequest = z.infer<typeof updateEmployeeRequestSchema>;

/** An inactive date runs from the hire date up to today (all YYYY-MM-DD). */
export function inactiveDateIssue(hireDate: string, inactiveOn: string, today: string) {
  if (inactiveOn < hireDate) return 'The inactive date cannot be before the hire date';
  if (inactiveOn > today) return 'The inactive date cannot be in the future';
  return null;
}

export const employeeSchema = z.object({
  id: z.uuid(),
  employeeCode: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  jobTitle: z.string(),
  jobLevel: z.string().nullable(),
  department: z.string(),
  countryCode: countryCodeSchema,
  region: z.string(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  fte: z.number(),
  hireDate: z.iso.date(),
  status: z.enum(EMPLOYEE_STATUSES),
  inactiveOn: z.iso.date().nullable(),
  countryFields: countryFieldsSchema,
});

export type Employee = z.infer<typeof employeeSchema>;

export const employeeResponseSchema = z.object({ employee: employeeSchema });

export type EmployeeResponse = z.infer<typeof employeeResponseSchema>;
