import type { Database } from '../db/client.ts';
import { componentId, insertEmployee, insertPayChange, insertPayItem } from './fixtures.ts';
import { insertPaidEmployee } from './insights-data.ts';

/**
 * Employees for export tests, with today being 24 Sep 2026: two in India (one inactive), one in
 * the USA whose job title looks like a formula, and one in Canada. The American's pay has an
 * item that ended in June and a raise scheduled for 1 Oct, neither of which is current.
 */
export async function insertExportData(db: Database) {
  await insertPaidEmployee(
    db,
    {
      employeeCode: 'IN-1',
      firstName: 'Aarav',
      lastName: 'Sharma',
      email: 'aarav.sharma@example.com',
      jobTitle: 'Software Engineer',
      jobLevel: 'L2',
      department: 'Engineering',
      countryCode: 'IN',
      region: 'Karnataka',
      countryFields: { pfApplicable: true, esiApplicable: false },
    },
    [
      { component: 'basic', amountMinor: 5_000_000, frequency: 'monthly' },
      { component: 'hra', amountMinor: 2_000_050, frequency: 'monthly' },
    ],
  );
  await insertPaidEmployee(
    db,
    {
      employeeCode: 'IN-2',
      firstName: 'Rohan',
      lastName: 'Mehta',
      email: 'rohan.mehta@example.com',
      department: 'Sales',
      jobTitle: 'Account Executive',
      countryCode: 'IN',
      region: 'Maharashtra',
      employmentType: 'part_time',
      fte: 0.5,
      status: 'inactive',
      inactiveOn: '2026-06-30',
    },
    [{ component: 'basic', amountMinor: 3_000_000, frequency: 'monthly' }],
  );

  const american = await insertEmployee(db, {
    employeeCode: 'US-1',
    firstName: 'Emma',
    lastName: 'Stone, Jr.',
    email: 'emma.stone@example.com',
    jobTitle: '=HYPERLINK("http://example.com")',
    department: 'Engineering',
    countryCode: 'US',
    region: 'California',
    hireDate: '2025-01-01',
    countryFields: { flsaStatus: 'exempt' },
  });
  const [baseSalary, bonus] = await Promise.all([
    componentId(db, 'base_salary', 'US'),
    componentId(db, 'bonus', 'US'),
  ]);
  const hire = await insertPayChange(db, american.id, '2025-01-01');
  const raise = await insertPayChange(db, american.id, '2026-10-01', 'revision');
  const item = {
    employeeId: american.id,
    currencyCode: 'USD',
    frequencyCode: 'yearly',
  };
  await insertPayItem(db, {
    ...item,
    payChangeId: hire,
    componentId: baseSalary,
    amountMinor: 12_000_000,
    effectiveFrom: '2025-01-01',
    effectiveTo: '2026-10-01',
  });
  await insertPayItem(db, {
    ...item,
    payChangeId: raise,
    componentId: baseSalary,
    amountMinor: 13_000_000,
    effectiveFrom: '2026-10-01',
  });
  await insertPayItem(db, {
    ...item,
    payChangeId: hire,
    componentId: bonus,
    amountMinor: 1_000_000,
    effectiveFrom: '2025-01-01',
    effectiveTo: '2026-06-01',
  });

  await insertPaidEmployee(
    db,
    {
      employeeCode: 'CA-1',
      firstName: 'Olivia',
      lastName: 'Tremblay',
      email: 'olivia.tremblay@example.com',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      countryCode: 'CA',
      region: 'Ontario',
    },
    [{ component: 'base_salary', amountMinor: 400_000, frequency: 'bi_weekly' }],
  );
}
