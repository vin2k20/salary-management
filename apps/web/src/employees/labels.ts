import type { EmployeeStatus, EmploymentType, FlsaStatus } from '@salary/shared';

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contractor: 'Contractor',
  intern: 'Intern',
};

export const STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
};

export const FLSA_STATUS_LABELS: Record<FlsaStatus, string> = {
  exempt: 'Exempt',
  non_exempt: 'Non-exempt',
};

/** Names of the employee fields, as shown in the change log. */
export const FIELD_LABELS: Record<string, string> = {
  employeeCode: 'Employee code',
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Work email',
  jobTitle: 'Job title',
  jobLevel: 'Job level',
  department: 'Department',
  countryCode: 'Country',
  region: 'Region',
  employmentType: 'Employment type',
  fte: 'FTE',
  hireDate: 'Hire date',
  status: 'Status',
  inactiveOn: 'Inactive from',
  flsaStatus: 'FLSA status',
  award: 'Award or agreement',
  pfApplicable: 'PF applies',
  esiApplicable: 'ESI applies',
};
