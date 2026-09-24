import type { CountryCode, EmploymentType } from '@salary/shared';

/**
 * Reference values for synthetic seed data. Names, codes and emails are generated; nothing here
 * describes a real person or a real company's pay.
 */

export interface Weighted {
  name: string;
  weight: number;
}

export const COUNTRY_SHARES: Record<CountryCode, number> = { IN: 0.6, US: 0.15, CA: 0.15, AU: 0.1 };

/** Order in which countries are generated, so employee codes stay stable. */
export const SEED_COUNTRY_ORDER: CountryCode[] = ['IN', 'US', 'CA', 'AU'];

export const EMPLOYMENT_TYPE_WEIGHTS: Record<EmploymentType, number> = {
  full_time: 80,
  part_time: 8,
  contractor: 8,
  intern: 4,
};

/** States, provinces and territories, weighted roughly by where tech and services staff work. */
export const REGIONS: Record<CountryCode, Weighted[]> = {
  IN: [
    { name: 'Karnataka', weight: 24 },
    { name: 'Maharashtra', weight: 18 },
    { name: 'Telangana', weight: 14 },
    { name: 'Tamil Nadu', weight: 12 },
    { name: 'Haryana', weight: 9 },
    { name: 'Delhi', weight: 7 },
    { name: 'Uttar Pradesh', weight: 6 },
    { name: 'Gujarat', weight: 4 },
    { name: 'West Bengal', weight: 3 },
    { name: 'Kerala', weight: 3 },
  ],
  US: [
    { name: 'California', weight: 24 },
    { name: 'New York', weight: 16 },
    { name: 'Texas', weight: 15 },
    { name: 'Washington', weight: 11 },
    { name: 'Massachusetts', weight: 9 },
    { name: 'Illinois', weight: 8 },
    { name: 'Georgia', weight: 7 },
    { name: 'Colorado', weight: 6 },
    { name: 'North Carolina', weight: 4 },
  ],
  CA: [
    { name: 'Ontario', weight: 40 },
    { name: 'British Columbia', weight: 20 },
    { name: 'Quebec', weight: 18 },
    { name: 'Alberta', weight: 13 },
    { name: 'Manitoba', weight: 4 },
    { name: 'Nova Scotia', weight: 3 },
    { name: 'Saskatchewan', weight: 2 },
  ],
  AU: [
    { name: 'New South Wales', weight: 36 },
    { name: 'Victoria', weight: 30 },
    { name: 'Queensland', weight: 16 },
    { name: 'Western Australia', weight: 9 },
    { name: 'South Australia', weight: 5 },
    { name: 'Australian Capital Territory', weight: 4 },
  ],
};

export const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const;

export type Level = (typeof LEVELS)[number];

export const LEVEL_WEIGHTS: Record<Level, number> = {
  L1: 20,
  L2: 30,
  L3: 25,
  L4: 15,
  L5: 7,
  L6: 3,
};

/** Contractors are hired for mid-level work. */
export const CONTRACTOR_LEVELS: Level[] = ['L2', 'L3', 'L4'];

export interface Department {
  name: string;
  weight: number;
  /** Pay relative to the country's base pay for the level. */
  payFactor: number;
  /** Job title for each level, L1 to L6. */
  titles: Record<Level, string>;
  internTitle: string;
  /** Roles paid under an award or as non-exempt staff at junior levels. */
  frontline: boolean;
}

export const DEPARTMENTS: Department[] = [
  {
    name: 'Engineering',
    weight: 30,
    payFactor: 1.15,
    titles: {
      L1: 'Associate Software Engineer',
      L2: 'Software Engineer',
      L3: 'Software Engineer II',
      L4: 'Senior Software Engineer',
      L5: 'Staff Software Engineer',
      L6: 'Principal Engineer',
    },
    internTitle: 'Software Engineering Intern',
    frontline: false,
  },
  {
    name: 'Data',
    weight: 7,
    payFactor: 1.12,
    titles: {
      L1: 'Associate Data Analyst',
      L2: 'Data Analyst',
      L3: 'Data Scientist',
      L4: 'Senior Data Scientist',
      L5: 'Lead Data Scientist',
      L6: 'Head of Data',
    },
    internTitle: 'Data Intern',
    frontline: false,
  },
  {
    name: 'Product',
    weight: 6,
    payFactor: 1.12,
    titles: {
      L1: 'Associate Product Manager',
      L2: 'Product Manager',
      L3: 'Product Manager II',
      L4: 'Senior Product Manager',
      L5: 'Group Product Manager',
      L6: 'Director of Product',
    },
    internTitle: 'Product Intern',
    frontline: false,
  },
  {
    name: 'Design',
    weight: 4,
    payFactor: 1.0,
    titles: {
      L1: 'Junior Designer',
      L2: 'Product Designer',
      L3: 'Product Designer II',
      L4: 'Senior Product Designer',
      L5: 'Lead Designer',
      L6: 'Head of Design',
    },
    internTitle: 'Design Intern',
    frontline: false,
  },
  {
    name: 'Sales',
    weight: 12,
    payFactor: 0.95,
    titles: {
      L1: 'Sales Development Representative',
      L2: 'Account Executive',
      L3: 'Senior Account Executive',
      L4: 'Sales Manager',
      L5: 'Regional Sales Director',
      L6: 'Vice President of Sales',
    },
    internTitle: 'Sales Intern',
    frontline: false,
  },
  {
    name: 'Marketing',
    weight: 6,
    payFactor: 0.95,
    titles: {
      L1: 'Marketing Coordinator',
      L2: 'Marketing Specialist',
      L3: 'Marketing Manager',
      L4: 'Senior Marketing Manager',
      L5: 'Marketing Director',
      L6: 'Vice President of Marketing',
    },
    internTitle: 'Marketing Intern',
    frontline: false,
  },
  {
    name: 'Customer Support',
    weight: 14,
    payFactor: 0.75,
    titles: {
      L1: 'Support Associate',
      L2: 'Support Specialist',
      L3: 'Senior Support Specialist',
      L4: 'Support Team Lead',
      L5: 'Support Manager',
      L6: 'Director of Support',
    },
    internTitle: 'Support Intern',
    frontline: true,
  },
  {
    name: 'Operations',
    weight: 9,
    payFactor: 0.85,
    titles: {
      L1: 'Operations Associate',
      L2: 'Operations Analyst',
      L3: 'Senior Operations Analyst',
      L4: 'Operations Manager',
      L5: 'Senior Operations Manager',
      L6: 'Director of Operations',
    },
    internTitle: 'Operations Intern',
    frontline: true,
  },
  {
    name: 'Finance',
    weight: 6,
    payFactor: 1.0,
    titles: {
      L1: 'Finance Associate',
      L2: 'Financial Analyst',
      L3: 'Senior Financial Analyst',
      L4: 'Finance Manager',
      L5: 'Finance Director',
      L6: 'Chief Financial Officer',
    },
    internTitle: 'Finance Intern',
    frontline: false,
  },
  {
    name: 'Human Resources',
    weight: 6,
    payFactor: 0.9,
    titles: {
      L1: 'HR Coordinator',
      L2: 'HR Generalist',
      L3: 'HR Business Partner',
      L4: 'Senior HR Business Partner',
      L5: 'HR Director',
      L6: 'Chief People Officer',
    },
    internTitle: 'HR Intern',
    frontline: false,
  },
];

/** Share of employees who have left and are kept as inactive. */
export const INACTIVE_SHARE = 0.05;

/** FTE values for part-time employees. */
export const PART_TIME_FTE = [0.5, 0.6, 0.75, 0.8];

/** Name of an Australian award for frontline roles. */
export const AUSTRALIAN_AWARD = 'Clerks - Private Sector Award 2020';
