import { z } from 'zod';
import { countryCodeSchema } from './countries.ts';
import { moneySchema } from './employee-list.ts';
import { EMPLOYMENT_TYPES } from './employees.ts';
import { displayCurrencySchema } from './fx-rates.ts';
import { booleanParam, optionalParam } from './query-params.ts';

/**
 * What the dashboard measures: the annual total of every component (cost to the company), or
 * gross pay only (earnings, allowances and bonuses, without employer contributions and benefits).
 */
export const PAY_MEASURES = ['total', 'gross'] as const;

export type PayMeasure = (typeof PAY_MEASURES)[number];

/**
 * Filters shared by every dashboard endpoint. Without a country the view covers every country in
 * the user's scope; org-wide totals are then in US dollars whatever the currency choice.
 */
export const insightsQuerySchema = z.object({
  country: optionalParam(countryCodeSchema),
  measure: optionalParam(z.enum(PAY_MEASURES)).default('total'),
  currency: optionalParam(displayCurrencySchema).default('local'),
  includeInactive: booleanParam,
});

export type InsightsQuery = z.infer<typeof insightsQuerySchema>;

export const OUTLIER_DIRECTIONS = ['above', 'below'] as const;

export type OutlierDirection = (typeof OUTLIER_DIRECTIONS)[number];

export const outliersQuerySchema = insightsQuerySchema.extend({
  /** Only employees paid above, or below, their peers; both when not set. */
  direction: optionalParam(z.enum(OUTLIER_DIRECTIONS)),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export type OutliersQuery = z.infer<typeof outliersQuerySchema>;

/** Fields every dashboard answer repeats, so the screen can say what it shows. */
const insightsResponseBase = {
  measure: z.enum(PAY_MEASURES),
  currency: displayCurrencySchema,
  /** Date of the exchange rates used, when any amount was converted to US dollars. */
  rateDate: z.iso.date().nullable(),
};

const costSchema = z.object({
  headcount: z.number().int().nonnegative(),
  annualCost: moneySchema,
  /** Annual cost / 12, rounded once. */
  monthlyCost: moneySchema,
});

export const insightsSummarySchema = z.object({
  ...insightsResponseBase,
  /** The one country shown, or null for every country in scope (totals then in US dollars). */
  countryCode: countryCodeSchema.nullable(),
  ...costSchema.shape,
  /** Employees counted in the headcount who have no current pay for the measure. */
  withoutPay: z.number().int().nonnegative(),
  countries: z.array(costSchema.extend({ countryCode: countryCodeSchema })),
});

export type InsightsSummary = z.infer<typeof insightsSummarySchema>;

export const payRangeSchema = z.object({
  countryCode: countryCodeSchema,
  /** Employees with pay for the measure; the figures below describe them. */
  headcount: z.number().int().positive(),
  minimum: moneySchema,
  lowerQuartile: moneySchema,
  median: moneySchema,
  upperQuartile: moneySchema,
  maximum: moneySchema,
  average: moneySchema,
});

export type PayRange = z.infer<typeof payRangeSchema>;

export const payRangeByCountryResponseSchema = z.object({
  ...insightsResponseBase,
  items: z.array(payRangeSchema),
});

export type PayRangeByCountryResponse = z.infer<typeof payRangeByCountryResponseSchema>;

export const jobTitlePaySchema = z.object({
  jobTitle: z.string(),
  headcount: z.number().int().positive(),
  average: moneySchema,
  median: moneySchema,
  minimum: moneySchema,
  maximum: moneySchema,
});

export type JobTitlePay = z.infer<typeof jobTitlePaySchema>;

export const payByJobTitleResponseSchema = z.object({
  ...insightsResponseBase,
  countryCode: countryCodeSchema,
  items: z.array(jobTitlePaySchema),
});

export type PayByJobTitleResponse = z.infer<typeof payByJobTitleResponseSchema>;

export const departmentCostSchema = costSchema.extend({ department: z.string() });

export type DepartmentCost = z.infer<typeof departmentCostSchema>;

export const costByDepartmentResponseSchema = z.object({
  ...insightsResponseBase,
  /** The one country shown, or null for every country in scope (costs then in US dollars). */
  countryCode: countryCodeSchema.nullable(),
  items: z.array(departmentCostSchema),
});

export type CostByDepartmentResponse = z.infer<typeof costByDepartmentResponseSchema>;

export const outlierSchema = z.object({
  id: z.uuid(),
  employeeCode: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  countryCode: countryCodeSchema,
  jobTitle: z.string(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  annualPay: moneySchema,
  peerMedian: moneySchema,
  /** People in the peer group, including the employee. */
  peerCount: z.number().int().positive(),
  /** Difference from the peer median in percent, one decimal place; negative when below. */
  differencePercent: z.number(),
  direction: z.enum(OUTLIER_DIRECTIONS),
});

export type Outlier = z.infer<typeof outlierSchema>;

export const outliersResponseSchema = z.object({
  ...insightsResponseBase,
  items: z.array(outlierSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  /** The peer comparison rule used, so the screen can explain it. */
  limitPercent: z.number().int().positive(),
  minimumGroupSize: z.number().int().positive(),
});

export type OutliersResponse = z.infer<typeof outliersResponseSchema>;
