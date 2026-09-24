import { z } from 'zod';
import { COUNTRY_CODES, countryCodeSchema, type CountryCode } from './countries.ts';
import { countryDetailIssues, countryFieldsSchema, employeeSchema } from './employee-record.ts';
import { moneySchema } from './employee-list.ts';
import { PAY_CHANGE_REASONS } from './pay-changes.ts';
import { PAY_COMPONENT_CATEGORIES } from './pay-components.ts';
import { PAY_FREQUENCY_CODES, type PayFrequencyCode } from './pay-frequency.ts';
import { DUPLICATE_COMPONENT_MESSAGE, payLineIssues, payLineSchema } from './pay-lines.ts';

/** Reasons HR picks when recording a pay change. Hire, transfer and import are set by the app. */
export const MANUAL_PAY_CHANGE_REASONS = ['promotion', 'revision', 'correction'] as const;

export type ManualPayChangeReason = (typeof MANUAL_PAY_CHANGE_REASONS)[number];

const frequencySchema = z.enum(PAY_FREQUENCY_CODES as [PayFrequencyCode, ...PayFrequencyCode[]]);

/**
 * A pay change: from the effective date, the components in `set` get a new amount and frequency
 * (or are added), and the components in `end` stop. The currency is checked against the
 * employee's country by the API.
 */
export const payChangeRequestSchema = z
  .object({
    effectiveFrom: z.iso.date('Enter a valid date'),
    reason: z.enum(MANUAL_PAY_CHANGE_REASONS, 'Choose a reason'),
    note: z
      .string()
      .trim()
      .max(500, 'Use at most 500 characters')
      .nullish()
      .transform((value) => (value === undefined || value === '' ? null : value)),
    set: z.array(payLineSchema).default([]),
    end: z.array(z.uuid('Choose a component')).default([]),
  })
  .superRefine((value, context) => {
    if (value.set.length + value.end.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['set'],
        message: 'Change, add or end at least one component',
      });
    }
    const seen = new Set(value.set.map((line) => line.componentId));
    value.end.forEach((componentId, index) => {
      if (seen.has(componentId)) {
        context.addIssue({
          code: 'custom',
          path: ['end', index],
          message: DUPLICATE_COMPONENT_MESSAGE,
        });
      }
      seen.add(componentId);
    });
  });

export type PayChangeRequest = z.infer<typeof payChangeRequestSchema>;

/** A pay change as a client sends it: the note and either list may be left out. */
export type PayChangeRequestBody = z.input<typeof payChangeRequestSchema>;

const COUNTRY_CHECK_FIELDS = ['countryCode', 'region', 'countryFields'];

/**
 * Moves an employee to another country (global HR only). Current pay ends on the effective date
 * and the new pay starts in the new country's currency. Country fields start empty unless given.
 */
export const transferRequestSchema = z
  .object({
    countryCode: z.enum(COUNTRY_CODES as [CountryCode, ...CountryCode[]], 'Choose a country'),
    region: z.string('Choose a region').trim(),
    countryFields: countryFieldsSchema.default({}),
    effectiveFrom: z.iso.date('Enter a valid date'),
    items: z.array(payLineSchema).min(1, 'Add at least one pay component in the new country'),
  })
  .superRefine(
    (value, context) => {
      for (const issue of countryDetailIssues(value)) {
        context.addIssue({ code: 'custom', ...issue });
      }
    },
    {
      when: ({ issues }) =>
        !issues.some((issue) => COUNTRY_CHECK_FIELDS.includes(String(issue.path?.[0]))),
    },
  )
  .superRefine(
    (value, context) => {
      for (const issue of payLineIssues(value.countryCode, value.items, 'items')) {
        context.addIssue({ code: 'custom', ...issue });
      }
    },
    {
      when: ({ issues }) =>
        !issues.some((issue) => ['countryCode', 'items'].includes(String(issue.path?.[0]))),
    },
  );

export type TransferRequest = z.infer<typeof transferRequestSchema>;

export const payComponentSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  category: z.enum(PAY_COMPONENT_CATEGORIES),
  /** Null for components used in all countries. */
  countryCode: countryCodeSchema.nullable(),
  defaultFrequency: frequencySchema,
  isActive: z.boolean(),
});

export type PayComponent = z.infer<typeof payComponentSchema>;

export const payComponentListQuerySchema = z.object({
  /** Components that can be used in this country: its own and those for all countries. */
  country: z.preprocess(
    (value) => (value === '' ? undefined : value),
    countryCodeSchema.optional(),
  ),
});

export const payComponentListResponseSchema = z.object({
  items: z.array(payComponentSchema),
  frequencies: z.array(
    z.object({ code: frequencySchema, name: z.string(), periodsPerYear: z.number().int() }),
  ),
});

export type PayComponentListResponse = z.infer<typeof payComponentListResponseSchema>;

/** Annual totals on a date and their monthly equivalents, in the employee's local currency. */
export const payTotalsSchema = z.object({
  annualTotal: moneySchema,
  monthlyTotal: moneySchema,
  /** Earnings, allowances and bonuses only. */
  annualGross: moneySchema,
  monthlyGross: moneySchema,
});

export type PayTotalsResponse = z.infer<typeof payTotalsSchema>;

/** GET /api/employees/:id: the details and today's pay totals (HLD 5). */
export const employeeDetailResponseSchema = z.object({
  employee: employeeSchema,
  payTotals: payTotalsSchema,
});

export type EmployeeDetailResponse = z.infer<typeof employeeDetailResponseSchema>;

const componentRefSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  category: z.enum(PAY_COMPONENT_CATEGORIES),
});

export const currentPayItemSchema = z.object({
  id: z.uuid(),
  component: componentRefSchema,
  amount: moneySchema,
  frequency: frequencySchema,
  annualAmount: moneySchema,
  monthlyAmount: moneySchema,
  effectiveFrom: z.iso.date(),
});

export type CurrentPayItem = z.infer<typeof currentPayItemSchema>;

export const currentPayResponseSchema = z.object({
  /** The date the pay applies on: today. */
  asOf: z.iso.date(),
  items: z.array(currentPayItemSchema),
  totals: payTotalsSchema,
});

export type CurrentPayResponse = z.infer<typeof currentPayResponseSchema>;

const periodAmountSchema = z.object({ amount: moneySchema, frequency: frequencySchema });

export const payHistoryEntrySchema = z.object({
  id: z.uuid(),
  effectiveFrom: z.iso.date(),
  reason: z.enum(PAY_CHANGE_REASONS),
  note: z.string().nullable(),
  /** True when the change starts after today, so it does not count in current pay yet. */
  scheduled: z.boolean(),
  createdAt: z.iso.datetime(),
  createdBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  /** Each component the change touched: before is null when added, after is null when ended. */
  lines: z.array(
    z.object({
      component: componentRefSchema,
      before: periodAmountSchema.nullable(),
      after: periodAmountSchema.nullable(),
    }),
  ),
});

export type PayHistoryEntry = z.infer<typeof payHistoryEntrySchema>;

export const payHistoryResponseSchema = z.object({ items: z.array(payHistoryEntrySchema) });

export type PayHistoryResponse = z.infer<typeof payHistoryResponseSchema>;

export const recordPayChangeResponseSchema = z.object({ payChange: payHistoryEntrySchema });

export type RecordPayChangeResponse = z.infer<typeof recordPayChangeResponseSchema>;
