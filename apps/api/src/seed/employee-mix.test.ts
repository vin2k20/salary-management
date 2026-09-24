import { COUNTRY_CODES, EMPLOYMENT_TYPES } from '@salary/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { generateEmployees, type SeedEmployee } from './employees.ts';
import { REGIONS } from './reference.ts';

const referenceDate = '2026-09-01';

function share(employees: SeedEmployee[], matches: (employee: SeedEmployee) => boolean) {
  return employees.filter(matches).length / employees.length;
}

describe('seed employees for 10,000', () => {
  let employees: SeedEmployee[];

  beforeAll(() => {
    employees = generateEmployees({ count: 10_000, seed: 20_260_924, referenceDate });
  });

  it('splits employees by country as 60% India, 15% USA, 15% Canada and 10% Australia', () => {
    const counts = Object.fromEntries(
      COUNTRY_CODES.map((code) => [
        code,
        employees.filter((employee) => employee.countryCode === code).length,
      ]),
    );
    expect(counts).toEqual({ IN: 6_000, US: 1_500, CA: 1_500, AU: 1_000 });
  });

  it('mixes employment types close to 80% full-time, 8% part-time, 8% contractor, 4% intern', () => {
    const expected = { full_time: 0.8, part_time: 0.08, contractor: 0.08, intern: 0.04 };
    for (const type of EMPLOYMENT_TYPES) {
      expect(
        Math.abs(share(employees, (employee) => employee.employmentType === type) - expected[type]),
      ).toBeLessThan(0.015);
    }
  });

  it('uses a region of the employee country', () => {
    for (const employee of employees) {
      expect(REGIONS[employee.countryCode].map((region) => region.name)).toContain(employee.region);
    }
  });

  it('gives part-time employees an FTE below one and everyone else a full FTE', () => {
    for (const employee of employees) {
      if (employee.employmentType === 'part_time') {
        expect(employee.fte).toBeLessThan(1);
        expect(employee.fte).toBeGreaterThanOrEqual(0.4);
      } else {
        expect(employee.fte).toBe(1);
      }
    }
  });

  it('marks a few employees inactive, with an inactive date after they were hired', () => {
    const inactive = employees.filter((employee) => employee.status === 'inactive');

    expect(inactive.length / employees.length).toBeGreaterThan(0.03);
    expect(inactive.length / employees.length).toBeLessThan(0.08);
    for (const employee of inactive) {
      const inactiveOn = employee.inactiveOn ?? '';
      expect(inactiveOn > employee.hireDate).toBe(true);
      expect(inactiveOn <= referenceDate).toBe(true);
    }
  });

  it('hires everyone on or before the reference date', () => {
    for (const employee of employees) {
      expect(employee.hireDate <= referenceDate).toBe(true);
    }
  });
});

describe('seed employees for small counts', () => {
  it('keeps the country split in proportion', () => {
    const employees = generateEmployees({ count: 20, seed: 7, referenceDate });
    const counts = COUNTRY_CODES.map(
      (code) => employees.filter((employee) => employee.countryCode === code).length,
    );
    expect(counts).toEqual([3, 3, 2, 12]);
  });
});
