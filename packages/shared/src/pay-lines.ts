import { z } from 'zod';
import { COUNTRIES, type CountryCode } from './countries.ts';
import { CURRENCY_CODES, toMinorUnits, type CurrencyCode } from './money.ts';
import { PAY_FREQUENCY_CODES, type PayFrequencyCode } from './pay-frequency.ts';

const AMOUNT_MESSAGE = 'Enter an amount above zero, such as 1250.50';

/** The amount in minor units, or null when it is not a positive amount in the currency. */
export function positiveMinorUnits(amount: string, currency: CurrencyCode): number | null {
  try {
    const minor = toMinorUnits(amount, currency);
    return minor > 0 ? minor : null;
  } catch {
    return null;
  }
}

/**
 * One pay component with its amount per period, as typed: a decimal string in the currency, so
 * forms and requests share one shape. The API turns it into minor units.
 */
export const payLineSchema = z
  .object({
    componentId: z.uuid('Choose a component'),
    amount: z.string(AMOUNT_MESSAGE).trim(),
    currency: z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]], 'Choose a currency'),
    frequency: z.enum(
      PAY_FREQUENCY_CODES as [PayFrequencyCode, ...PayFrequencyCode[]],
      'Choose how often it is paid',
    ),
  })
  .superRefine(
    (line, context) => {
      if (positiveMinorUnits(line.amount, line.currency) === null) {
        context.addIssue({ code: 'custom', path: ['amount'], message: AMOUNT_MESSAGE });
      }
    },
    // The amount can be checked as soon as it and the currency are readable.
    {
      when: ({ issues }) =>
        !issues.some((issue) => ['amount', 'currency'].includes(String(issue.path?.[0]))),
    },
  );

export type PayLine = z.infer<typeof payLineSchema>;

export const DUPLICATE_COMPONENT_MESSAGE = 'Each component can appear only once in a pay change';

export interface PayLineIssue {
  path: (string | number)[];
  message: string;
}

/**
 * Checks pay lines against the employee's country: each in the country's currency, and each
 * component once. `key` is the field that holds the lines, for the issue paths.
 */
export function payLineIssues(
  countryCode: CountryCode,
  lines: readonly Pick<PayLine, 'componentId' | 'currency'>[],
  key: string,
): PayLineIssue[] {
  const { name, currencyCode } = COUNTRIES[countryCode];
  const issues: PayLineIssue[] = [];
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    if (line.currency !== currencyCode) {
      issues.push({
        path: [key, index, 'currency'],
        message: `Pay for employees in ${name} is in ${currencyCode}`,
      });
    }
    if (seen.has(line.componentId)) {
      issues.push({ path: [key, index, 'componentId'], message: DUPLICATE_COMPONENT_MESSAGE });
    }
    seen.add(line.componentId);
  });
  return issues;
}
