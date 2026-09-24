/** Categories of pay components. Gross pay counts earnings, allowances and bonuses only. */
export const PAY_COMPONENT_CATEGORIES = [
  'earning',
  'allowance',
  'bonus',
  'employer_contribution',
  'benefit',
  'other',
] as const;

export type PayComponentCategory = (typeof PAY_COMPONENT_CATEGORIES)[number];

export const GROSS_PAY_CATEGORIES: readonly PayComponentCategory[] = [
  'earning',
  'allowance',
  'bonus',
];
