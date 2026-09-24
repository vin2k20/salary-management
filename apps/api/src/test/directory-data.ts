import type { Database } from '../db/client.ts';
import { insertEmployeeWithPay, insertRates } from './fixtures.ts';

/**
 * A small directory: two people in India (one inactive plus a Sharma pair for search), two in the
 * USA and one in Canada, with rates of 24 Sep 2026.
 */
export async function insertDirectoryData(db: Database) {
  await insertRates(db);
  const engineer = { department: 'Engineering', jobTitle: 'Software Engineer' };
  await insertEmployeeWithPay(
    db,
    {
      employeeCode: 'IN90001',
      firstName: 'Aarav',
      lastName: 'Sharma',
      countryCode: 'IN',
      region: 'Karnataka',
      ...engineer,
    },
    { component: 'basic', amountMinor: 10_000_000, frequency: 'monthly', currency: 'INR' },
  );
  await insertEmployeeWithPay(
    db,
    {
      employeeCode: 'IN90002',
      firstName: 'Priya',
      lastName: 'Sharma',
      countryCode: 'IN',
      region: 'Maharashtra',
      department: 'Sales',
      jobTitle: 'Account Executive',
      employmentType: 'part_time',
      fte: 0.5,
    },
    { component: 'basic', amountMinor: 5_000_000, frequency: 'monthly', currency: 'INR' },
  );
  await insertEmployeeWithPay(
    db,
    {
      employeeCode: 'IN90003',
      firstName: 'Rohan',
      lastName: 'Mehta',
      countryCode: 'IN',
      region: 'Karnataka',
      status: 'inactive',
      inactiveOn: '2026-06-30',
      ...engineer,
    },
    { component: 'basic', amountMinor: 9_000_000, frequency: 'monthly', currency: 'INR' },
  );
  await insertEmployeeWithPay(
    db,
    {
      employeeCode: 'US90001',
      firstName: 'Emma',
      lastName: 'Stone',
      countryCode: 'US',
      region: 'California',
      ...engineer,
    },
    { component: 'base_salary', amountMinor: 500_000, frequency: 'bi_weekly', currency: 'USD' },
  );
  await insertEmployeeWithPay(
    db,
    {
      employeeCode: 'US90002',
      firstName: 'Liam',
      lastName: 'Brown',
      countryCode: 'US',
      region: 'Texas',
      department: 'Sales',
      jobTitle: 'Account Executive',
      employmentType: 'contractor',
    },
    { component: 'contract_fee', amountMinor: 800_000, frequency: 'monthly', currency: 'USD' },
  );
  await insertEmployeeWithPay(
    db,
    {
      employeeCode: 'CA90001',
      firstName: 'Olivia',
      lastName: 'Tremblay',
      countryCode: 'CA',
      region: 'Ontario',
      ...engineer,
    },
    { component: 'base_salary', amountMinor: 400_000, frequency: 'bi_weekly', currency: 'CAD' },
  );
}
