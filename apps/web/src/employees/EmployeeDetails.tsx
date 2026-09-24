import { COUNTRIES, REGION_LABELS, type Employee } from '@salary/shared';
import type { ReactNode } from 'react';
import { formatDate } from '../lib/format.ts';
import { EMPLOYMENT_TYPE_LABELS, FLSA_STATUS_LABELS } from './labels.ts';

function yesNo(value: boolean | undefined): string {
  if (value === undefined) return 'Not set';
  return value ? 'Yes' : 'No';
}

/** The country-specific fields of the employee's own country. */
function countryFieldRows(employee: Employee): [string, ReactNode][] {
  const fields = employee.countryFields;
  switch (employee.countryCode) {
    case 'US':
      return [
        ['FLSA status', fields.flsaStatus ? FLSA_STATUS_LABELS[fields.flsaStatus] : 'Not set'],
      ];
    case 'AU':
      return [['Award or agreement', fields.award ?? 'Not set']];
    case 'IN':
      return [
        ['PF applies', yesNo(fields.pfApplicable)],
        ['ESI applies', yesNo(fields.esiApplicable)],
      ];
    case 'CA':
      return [];
  }
}

/** An employee's details, including the fields that only apply in their country. */
export function EmployeeDetails({ employee }: { employee: Employee }) {
  const rows: [string, ReactNode][] = [
    ['Employee code', employee.employeeCode],
    ['Work email', employee.email],
    ['Job title', employee.jobTitle],
    ['Job level', employee.jobLevel ?? 'Not set'],
    ['Department', employee.department],
    ['Country', COUNTRIES[employee.countryCode].name],
    [REGION_LABELS[employee.countryCode], employee.region],
    ['Employment type', EMPLOYMENT_TYPE_LABELS[employee.employmentType]],
    ['FTE', String(employee.fte)],
    ['Hire date', formatDate(employee.hireDate)],
    [
      'Status',
      employee.inactiveOn === null ? 'Active' : `Inactive from ${formatDate(employee.inactiveOn)}`,
    ],
    ...countryFieldRows(employee),
  ];
  return (
    <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="mt-1 font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
