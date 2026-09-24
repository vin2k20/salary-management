/** Test data for an employee in India with pay, shared by the employee page tests. */

export const ids = {
  priya: '66666666-6666-4666-8666-666666666666',
  basic: 'b0000000-0000-4000-8000-000000000001',
  hra: 'b0000000-0000-4000-8000-000000000002',
  lta: 'b0000000-0000-4000-8000-000000000003',
  contractFee: 'b0000000-0000-4000-8000-000000000004',
  usBase: 'b0000000-0000-4000-8000-000000000005',
};

export const priya = {
  id: ids.priya,
  employeeCode: 'IN00042',
  firstName: 'Priya',
  lastName: 'Nair',
  email: 'priya.nair@acme.example.com',
  jobTitle: 'Data Analyst',
  jobLevel: 'L2',
  department: 'Data',
  countryCode: 'IN',
  region: 'Kerala',
  employmentType: 'full_time',
  fte: 1,
  hireDate: '2025-01-01',
  status: 'active',
  inactiveOn: null,
  countryFields: { pfApplicable: true, esiApplicable: false },
};

export function inr(amountMinor: number) {
  return { amountMinor, currency: 'INR' };
}

export const payTotals = {
  annualTotal: inr(84_000_000),
  monthlyTotal: inr(7_000_000),
  annualGross: inr(84_000_000),
  monthlyGross: inr(7_000_000),
};

const component = (id: string, code: string, name: string, category = 'earning') => ({
  id,
  code,
  name,
  category,
});

export const components = {
  IN: [
    { ...component(ids.contractFee, 'contract_fee', 'Contract fee'), countryCode: null },
    { ...component(ids.basic, 'basic', 'Basic'), countryCode: 'IN' },
    { ...component(ids.hra, 'hra', 'House rent allowance', 'allowance'), countryCode: 'IN' },
    { ...component(ids.lta, 'lta', 'Leave travel allowance', 'allowance'), countryCode: 'IN' },
  ].map((item) => ({
    ...item,
    defaultFrequency: item.code === 'lta' ? 'yearly' : 'monthly',
    isActive: true,
  })),
  US: [
    {
      ...component(ids.contractFee, 'contract_fee', 'Contract fee'),
      countryCode: null,
      defaultFrequency: 'monthly',
      isActive: true,
    },
    {
      ...component(ids.usBase, 'base_salary', 'Base salary or wages'),
      countryCode: 'US',
      defaultFrequency: 'bi_weekly',
      isActive: true,
    },
  ],
};

export const frequencies = [
  { code: 'weekly', name: 'Weekly', periodsPerYear: 52 },
  { code: 'bi_weekly', name: 'Every two weeks', periodsPerYear: 26 },
  { code: 'monthly', name: 'Monthly', periodsPerYear: 12 },
  { code: 'bi_monthly', name: 'Every two months', periodsPerYear: 6 },
  { code: 'quarterly', name: 'Quarterly', periodsPerYear: 4 },
  { code: 'bi_quarterly', name: 'Every two quarters', periodsPerYear: 2 },
  { code: 'half_yearly', name: 'Half-yearly', periodsPerYear: 2 },
  { code: 'yearly', name: 'Yearly', periodsPerYear: 1 },
];

export const currentPay = {
  asOf: '2026-09-24',
  items: [
    {
      id: 'c0000000-0000-4000-8000-000000000001',
      component: component(ids.basic, 'basic', 'Basic'),
      amount: inr(5_000_000),
      frequency: 'monthly',
      annualAmount: inr(60_000_000),
      monthlyAmount: inr(5_000_000),
      effectiveFrom: '2026-04-01',
    },
    {
      id: 'c0000000-0000-4000-8000-000000000002',
      component: component(ids.hra, 'hra', 'House rent allowance', 'allowance'),
      amount: inr(2_000_000),
      frequency: 'monthly',
      annualAmount: inr(24_000_000),
      monthlyAmount: inr(2_000_000),
      effectiveFrom: '2025-01-01',
    },
  ],
  totals: payTotals,
};

export const payHistory = {
  items: [
    {
      id: 'd0000000-0000-4000-8000-000000000003',
      effectiveFrom: '2026-12-01',
      reason: 'correction',
      note: null,
      scheduled: true,
      createdAt: '2026-09-20T09:00:00.000Z',
      createdBy: { id: '6f1c2a4e-8b4d-4c5e-9f3a-2b7d1e0c9a11', name: 'Global HR' },
      lines: [
        {
          component: component(ids.hra, 'hra', 'House rent allowance', 'allowance'),
          before: { amount: inr(2_000_000), frequency: 'monthly' },
          after: null,
        },
      ],
    },
    {
      id: 'd0000000-0000-4000-8000-000000000002',
      effectiveFrom: '2026-04-01',
      reason: 'revision',
      note: 'Annual review',
      scheduled: false,
      createdAt: '2026-03-20T09:00:00.000Z',
      createdBy: { id: '6f1c2a4e-8b4d-4c5e-9f3a-2b7d1e0c9a11', name: 'Global HR' },
      lines: [
        {
          component: component(ids.basic, 'basic', 'Basic'),
          before: { amount: inr(4_500_000), frequency: 'monthly' },
          after: { amount: inr(5_000_000), frequency: 'monthly' },
        },
        {
          component: component(ids.lta, 'lta', 'Leave travel allowance', 'allowance'),
          before: null,
          after: { amount: inr(4_000_000), frequency: 'yearly' },
        },
      ],
    },
  ],
};
