import { COUNTRIES, annualAmountMinor, type CountryCode } from '@salary/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { generateEmployees, type SeedEmployee } from './employees.ts';
import { generatePay, type SeedPay, type SeedPayItem } from './pay.ts';

const options = { count: 2_000, seed: 20_260_924, referenceDate: '2026-09-01' };

function currentItems(pay: SeedPay, employeeId: string, date: string) {
  return pay.payItems.filter(
    (item) =>
      item.employeeId === employeeId &&
      item.effectiveFrom <= date &&
      (item.effectiveTo === null || item.effectiveTo > date),
  );
}

function annualOf(items: SeedPayItem[], codes?: string[]) {
  return items
    .filter((item) => codes === undefined || codes.includes(item.componentCode))
    .reduce((sum, item) => sum + annualAmountMinor(item.amountMinor, item.frequencyCode), 0);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

describe('generatePay', () => {
  let employees: SeedEmployee[];
  let pay: SeedPay;

  beforeAll(() => {
    employees = generateEmployees(options);
    pay = generatePay(employees, options);
  });

  it('returns the same pay for the same seed', () => {
    expect(generatePay(employees, options)).toEqual(pay);
  });

  it('gives every employee current pay in their local currency on the reference date', () => {
    for (const employee of employees) {
      const items = currentItems(pay, employee.id, options.referenceDate);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.amountMinor).toBeGreaterThan(0);
        expect(item.currencyCode).toBe(COUNTRIES[employee.countryCode].currencyCode);
      }
    }
  });

  it('pays each employment type with the right components', () => {
    const basePay: Record<CountryCode, string[]> = {
      IN: ['basic', 'hra', 'special_allowance'],
      US: ['base_salary', 'employer_fica'],
      CA: ['base_salary', 'employer_cpp', 'employer_ei'],
      AU: ['base_salary', 'superannuation'],
    };
    for (const employee of employees) {
      const codes = currentItems(pay, employee.id, options.referenceDate).map(
        (item) => item.componentCode,
      );
      if (employee.employmentType === 'contractor') {
        expect(codes).toEqual(['contract_fee']);
      } else if (employee.employmentType === 'intern') {
        expect(codes).toEqual(['stipend']);
      } else {
        expect(codes).toEqual(expect.arrayContaining(basePay[employee.countryCode]));
      }
    }
  });

  it('records one to three pay changes, starting with the hire', () => {
    for (const employee of employees) {
      const changes = pay.payChanges
        .filter((change) => change.employeeId === employee.id)
        .map((change) => change.effectiveFrom);
      expect(changes.length).toBeGreaterThanOrEqual(1);
      expect(changes.length).toBeLessThanOrEqual(3);
      expect(changes[0]).toBe(employee.hireDate);
      expect(changes).toEqual([...changes].sort());
      expect(new Set(changes).size).toBe(changes.length);
      expect(changes.every((date) => date <= options.referenceDate)).toBe(true);
    }
    const first = pay.payChanges.filter((change) => change.reason === 'hire');
    expect(first).toHaveLength(employees.length);
  });

  it('ends each item where the next one for the same component starts', () => {
    const byComponent = new Map<string, SeedPayItem[]>();
    for (const item of pay.payItems) {
      const key = `${item.employeeId}/${item.componentCode}`;
      byComponent.set(key, [...(byComponent.get(key) ?? []), item]);
    }
    for (const items of byComponent.values()) {
      const sorted = [...items].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
      sorted.forEach((item, index) => {
        const next = sorted[index + 1];
        expect(item.effectiveTo).toBe(next ? next.effectiveFrom : null);
      });
    }
  });

  it('keeps full-time pay in a realistic range for each country', () => {
    const ranges: Record<CountryCode, [number, number]> = {
      IN: [800_000_00, 3_000_000_00],
      US: [80_000_00, 200_000_00],
      CA: [65_000_00, 170_000_00],
      AU: [75_000_00, 190_000_00],
    };
    for (const [country, [low, high]] of Object.entries(ranges)) {
      const totals = employees
        .filter((employee) => employee.countryCode === country)
        .filter((employee) => employee.employmentType === 'full_time')
        .map((employee) => annualOf(currentItems(pay, employee.id, options.referenceDate)));
      expect(median(totals)).toBeGreaterThan(low);
      expect(median(totals)).toBeLessThan(high);
    }
  });

  it('pays part-time employees in proportion to their FTE', () => {
    const baseByTitle = (type: string) =>
      employees
        .filter((employee) => employee.countryCode === 'IN' && employee.employmentType === type)
        .map(
          (employee) =>
            annualOf(currentItems(pay, employee.id, options.referenceDate), ['basic']) /
            employee.fte,
        );
    const ratio = median(baseByTitle('part_time')) / median(baseByTitle('full_time'));
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(1.3);
  });
});
