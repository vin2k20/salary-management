import {
  EMPLOYMENT_TYPES,
  type CountryCode,
  type EmployeeStatus,
  type EmploymentType,
} from '@salary/shared';
import type { Faker } from '@faker-js/faker';
import { addDays } from './dates.ts';
import { dateBetween, pickWeighted, seededFaker } from './random.ts';
import {
  AUSTRALIAN_AWARD,
  CONTRACTOR_LEVELS,
  COUNTRY_SHARES,
  DEPARTMENTS,
  EMPLOYMENT_TYPE_WEIGHTS,
  INACTIVE_SHARE,
  LEVELS,
  LEVEL_WEIGHTS,
  PART_TIME_FTE,
  REGIONS,
  SEED_COUNTRY_ORDER,
  type Department,
  type Level,
} from './reference.ts';

export interface SeedOptions {
  count: number;
  seed: number;
  /** Date the data set is generated for (YYYY-MM-DD); fixed, so every run gives the same data. */
  referenceDate: string;
}

export interface SeedEmployee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  jobLevel: Level | null;
  department: string;
  countryCode: CountryCode;
  region: string;
  employmentType: EmploymentType;
  fte: number;
  hireDate: string;
  status: EmployeeStatus;
  inactiveOn: string | null;
  countryFields: Record<string, unknown>;
  /** Department pay factor, used by the pay generator. */
  payFactor: number;
}

/** Employees per country, in proportion to the country shares (largest remainder method). */
export function countryCounts(count: number): Record<CountryCode, number> {
  const exact = SEED_COUNTRY_ORDER.map((code) => ({ code, value: count * COUNTRY_SHARES[code] }));
  const counts = Object.fromEntries(
    exact.map(({ code, value }) => [code, Math.floor(value)]),
  ) as Record<CountryCode, number>;
  let remaining = count - Object.values(counts).reduce((sum, value) => sum + value, 0);
  const byRemainder = [...exact].sort(
    (a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value)),
  );
  for (const { code } of byRemainder) {
    if (remaining === 0) break;
    counts[code] += 1;
    remaining -= 1;
  }
  return counts;
}

/** Generates synthetic employees. The same options always give the same employees. */
export function generateEmployees({ count, seed, referenceDate }: SeedOptions): SeedEmployee[] {
  const random = seededFaker(seed);
  const counts = countryCounts(count);
  const usedEmails = new Set<string>();
  const employees: SeedEmployee[] = [];

  SEED_COUNTRY_ORDER.forEach((countryCode, countryIndex) => {
    const names = seededFaker(seed + countryIndex + 1, countryCode);
    for (let index = 1; index <= counts[countryCode]; index += 1) {
      employees.push(
        generateEmployee({ random, names, countryCode, index, referenceDate, usedEmails }),
      );
    }
  });

  return employees;
}

function generateEmployee({
  random,
  names,
  countryCode,
  index,
  referenceDate,
  usedEmails,
}: {
  random: Faker;
  names: Faker;
  countryCode: CountryCode;
  index: number;
  referenceDate: string;
  usedEmails: Set<string>;
}): SeedEmployee {
  const employmentType = pickWeighted(
    random,
    EMPLOYMENT_TYPES.map((type) => [type, EMPLOYMENT_TYPE_WEIGHTS[type]]),
  );
  const department = pickWeighted(
    random,
    DEPARTMENTS.map((entry) => [entry, entry.weight]),
  );
  const jobLevel = employmentType === 'intern' ? null : pickLevel(random, employmentType);
  const region = pickWeighted(
    random,
    REGIONS[countryCode].map((entry) => [entry.name, entry.weight]),
  );

  // Interns joined within the last year; others up to ten years ago.
  const earliestHire = addDays(referenceDate, employmentType === 'intern' ? -330 : -3650);
  const hireDate = dateBetween(random, earliestHire, addDays(referenceDate, -14));
  const leftBy = addDays(hireDate, 60);
  const inactive =
    random.number.float({ min: 0, max: 1 }) < INACTIVE_SHARE && leftBy < referenceDate;
  const inactiveOn = inactive ? dateBetween(random, leftBy, referenceDate) : null;

  const firstName = names.person.firstName();
  const lastName = names.person.lastName();

  return {
    id: random.string.uuid(),
    employeeCode: `${countryCode}${String(index).padStart(5, '0')}`,
    firstName,
    lastName,
    email: uniqueEmail(firstName, lastName, usedEmails),
    jobTitle: jobLevel === null ? department.internTitle : department.titles[jobLevel],
    jobLevel,
    department: department.name,
    countryCode,
    region,
    employmentType,
    fte: employmentType === 'part_time' ? random.helpers.arrayElement(PART_TIME_FTE) : 1,
    hireDate,
    status: inactive ? 'inactive' : 'active',
    inactiveOn,
    countryFields: countryFields(countryCode, employmentType, department, jobLevel),
    payFactor: department.payFactor,
  };
}

function pickLevel(random: Faker, employmentType: EmploymentType): Level {
  const levels = employmentType === 'contractor' ? CONTRACTOR_LEVELS : [...LEVELS];
  return pickWeighted(
    random,
    levels.map((level) => [level, LEVEL_WEIGHTS[level]]),
  );
}

/** Emails use the reserved example.com domain, so they can never reach a real mailbox. */
function uniqueEmail(firstName: string, lastName: string, usedEmails: Set<string>): string {
  const local = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '');
  let email = `${local}@acme.example.com`;
  for (let suffix = 2; usedEmails.has(email); suffix += 1) {
    email = `${local}${String(suffix)}@acme.example.com`;
  }
  usedEmails.add(email);
  return email;
}

function countryFields(
  countryCode: CountryCode,
  employmentType: EmploymentType,
  department: Department,
  jobLevel: Level | null,
): Record<string, unknown> {
  const employee = employmentType !== 'contractor';
  const junior = jobLevel === null || jobLevel === 'L1' || jobLevel === 'L2';
  switch (countryCode) {
    case 'US':
      return employee
        ? {
            flsaStatus:
              employmentType === 'part_time' ||
              employmentType === 'intern' ||
              (department.frontline && junior)
                ? 'non_exempt'
                : 'exempt',
          }
        : {};
    case 'AU':
      return employee && department.frontline ? { award: AUSTRALIAN_AWARD } : {};
    case 'IN':
      return { pfApplicable: employee && employmentType !== 'intern', esiApplicable: false };
    case 'CA':
      return {};
  }
}
