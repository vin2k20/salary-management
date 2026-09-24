export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contractor', 'intern'] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYEE_STATUSES = ['active', 'inactive'] as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];
