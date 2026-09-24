import type { Faker } from '@faker-js/faker';
import {
  COUNTRIES,
  type CountryCode,
  type CurrencyCode,
  type PayChangeReason,
  type PayFrequencyCode,
} from '@salary/shared';
import { addDays } from './dates.ts';
import type { SeedEmployee, SeedOptions } from './employees.ts';
import { seededFaker } from './random.ts';
import type { Level } from './reference.ts';

/**
 * Synthetic pay for seeded employees, from the components and approximate 2026 rates in
 * docs/research-country-pay-structures.md. Amounts are drawn as whole currency units and stored in
 * minor units. Employer contributions are stored as amounts, as the application does.
 */

export interface SeedPayChange {
  id: string;
  employeeId: string;
  effectiveFrom: string;
  reason: PayChangeReason;
}

export interface SeedPayItem {
  employeeId: string;
  payChangeId: string;
  componentCode: string;
  /** Country of the component, or null for components used in all countries. */
  componentCountry: CountryCode | null;
  amountMinor: number;
  currencyCode: CurrencyCode;
  frequencyCode: PayFrequencyCode;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface SeedPay {
  payChanges: SeedPayChange[];
  payItems: SeedPayItem[];
}

/** Annual base pay by level before the department factor, in whole units of local currency. */
const ANNUAL_BASE: Record<CountryCode, Record<Level, number>> = {
  IN: { L1: 600_000, L2: 1_000_000, L3: 1_600_000, L4: 2_600_000, L5: 4_000_000, L6: 6_000_000 },
  US: { L1: 70_000, L2: 95_000, L3: 125_000, L4: 160_000, L5: 200_000, L6: 260_000 },
  CA: { L1: 60_000, L2: 80_000, L3: 105_000, L4: 135_000, L5: 170_000, L6: 215_000 },
  AU: { L1: 70_000, L2: 90_000, L3: 115_000, L4: 145_000, L5: 180_000, L6: 230_000 },
};

/** Monthly intern stipend, in whole units of local currency. */
const MONTHLY_STIPEND: Record<CountryCode, number> = {
  IN: 25_000,
  US: 3_500,
  CA: 3_000,
  AU: 3_200,
};

/** Contractors bill more than employees because they get no benefits or contributions. */
const CONTRACTOR_PREMIUM = 1.25;

/** Share of employees paid well above or below their peers, so the dashboard has outliers. */
const OUTLIER_SHARE = 0.04;

/** Month and day of the yearly pay revision: April in India, January elsewhere. */
const REVISION_DAY: Record<CountryCode, string> = {
  IN: '04-01',
  US: '01-01',
  CA: '01-01',
  AU: '01-01',
};

interface Component {
  code: string;
  country: CountryCode | null;
  frequency: PayFrequencyCode;
  /** Amount per period in whole units. */
  amount: number;
}

/** Choices made once per employee, so every pay change has the same components. */
interface Profile {
  bonusShare: number;
  commissionShare: number;
  hasBonus: boolean;
  /** Employer health cover: per month in the USA and Canada, per year in India. */
  healthCover: number;
  retirementMatchShare: number;
  hasRetirementMatch: boolean;
  allowancePerPeriod: number;
  unemploymentPerYear: number;
}

/** Generates pay changes and pay items for employees. The same options give the same pay. */
export function generatePay(
  employees: SeedEmployee[],
  { seed, referenceDate }: SeedOptions,
): SeedPay {
  const random = seededFaker(seed + 100);
  const payChanges: SeedPayChange[] = [];
  const payItems: SeedPayItem[] = [];

  for (const employee of employees) {
    const profile = drawProfile(random, employee);
    const currentBase = drawCurrentBase(random, employee);
    const changes = planChanges(random, employee, referenceDate);

    // Work back from current pay: each earlier change paid less by that change's raise.
    const bases: number[] = [];
    let base = currentBase;
    for (let index = changes.length - 1; index >= 0; index -= 1) {
      bases[index] = base;
      const change = changes[index];
      if (change && change.reason !== 'hire') {
        base /=
          change.reason === 'promotion'
            ? random.number.float({ min: 1.1, max: 1.2 })
            : random.number.float({ min: 1.03, max: 1.1 });
      }
    }

    const currencyCode = COUNTRIES[employee.countryCode].currencyCode;
    changes.forEach((change, index) => {
      const id = random.string.uuid();
      payChanges.push({ id, employeeId: employee.id, ...change });
      const next = changes[index + 1];
      for (const component of buildPackage(employee, bases[index] ?? currentBase, profile)) {
        payItems.push({
          employeeId: employee.id,
          payChangeId: id,
          componentCode: component.code,
          componentCountry: component.country,
          amountMinor: Math.max(1, Math.round(component.amount)) * 100,
          currencyCode,
          frequencyCode: component.frequency,
          effectiveFrom: change.effectiveFrom,
          effectiveTo: next ? next.effectiveFrom : null,
        });
      }
    });
  }

  return { payChanges, payItems };
}

function drawProfile(random: Faker, employee: SeedEmployee): Profile {
  const juniorLevel = employee.jobLevel === 'L1' || employee.jobLevel === 'L2';
  return {
    bonusShare: juniorLevel
      ? random.number.float({ min: 0.04, max: 0.08 })
      : random.number.float({ min: 0.08, max: 0.18 }),
    commissionShare: random.number.float({ min: 0.1, max: 0.25 }),
    hasBonus: employee.countryCode === 'AU' ? random.datatype.boolean(0.4) : true,
    healthCover: {
      US: random.number.int({ min: 550, max: 1_100 }),
      CA: random.number.int({ min: 250, max: 500 }),
      IN: random.number.int({ min: 15_000, max: 30_000 }),
      AU: 0,
    }[employee.countryCode],
    retirementMatchShare: random.number.float({ min: 0.03, max: 0.05 }),
    hasRetirementMatch: employee.countryCode === 'US' || random.datatype.boolean(0.5),
    allowancePerPeriod: random.number.int({ min: 40, max: 120 }),
    unemploymentPerYear: 42 + random.number.int({ min: 250, max: 600 }),
  };
}

/** Current annual base in whole units, or the monthly stipend for interns. */
function drawCurrentBase(random: Faker, employee: SeedEmployee): number {
  if (employee.jobLevel === null) {
    return MONTHLY_STIPEND[employee.countryCode] * random.number.float({ min: 0.9, max: 1.1 });
  }
  let spread = random.number.float({ min: 0.85, max: 1.15 });
  if (random.number.float({ min: 0, max: 1 }) < OUTLIER_SHARE) {
    spread = random.datatype.boolean()
      ? random.number.float({ min: 1.3, max: 1.45 })
      : random.number.float({ min: 0.62, max: 0.75 });
  }
  const annual = ANNUAL_BASE[employee.countryCode][employee.jobLevel] * employee.payFactor * spread;
  return employee.employmentType === 'contractor' ? annual * CONTRACTOR_PREMIUM : annual;
}

/** One to three pay changes: the hire, then up to two recent yearly revisions or promotions. */
function planChanges(
  random: Faker,
  employee: SeedEmployee,
  referenceDate: string,
): { effectiveFrom: string; reason: PayChangeReason }[] {
  const hire = { effectiveFrom: employee.hireDate, reason: 'hire' as const };
  if (employee.employmentType === 'intern') return [hire];

  const lastDate = employee.inactiveOn ?? referenceDate;
  const firstRevision = addDays(employee.hireDate, 90);
  const revisionDates: string[] = [];
  for (
    let year = Number(employee.hireDate.slice(0, 4));
    year <= Number(lastDate.slice(0, 4));
    year += 1
  ) {
    const date = `${String(year)}-${REVISION_DAY[employee.countryCode]}`;
    if (date >= firstRevision && date <= lastDate) revisionDates.push(date);
  }

  const extra = Math.min(random.number.int({ min: 0, max: 2 }), revisionDates.length);
  const later = revisionDates.slice(revisionDates.length - extra).map((effectiveFrom) => ({
    effectiveFrom,
    reason: random.datatype.boolean(0.25) ? ('promotion' as const) : ('revision' as const),
  }));
  return [hire, ...later];
}

/** Pay components for one pay change, from the annual base (or monthly stipend for interns). */
function buildPackage(employee: SeedEmployee, base: number, profile: Profile): Component[] {
  const country = employee.countryCode;
  if (employee.employmentType === 'intern') {
    return [{ code: 'stipend', country: null, frequency: 'monthly', amount: base }];
  }
  if (employee.employmentType === 'contractor') {
    return [{ code: 'contract_fee', country: null, frequency: 'monthly', amount: base / 12 }];
  }

  const annual = base * employee.fte;
  const fullTime = employee.employmentType === 'full_time';
  const components: Component[] = [];
  const add = (code: string, frequency: PayFrequencyCode, amount: number) => {
    components.push({ code, country, frequency, amount });
  };

  switch (country) {
    case 'IN': {
      const monthly = annual / 12;
      const basic = monthly * 0.5;
      const hra = basic * 0.4;
      const lta = basic;
      add('basic', 'monthly', basic);
      add('hra', 'monthly', hra);
      add('special_allowance', 'monthly', monthly - basic - hra - lta / 12);
      add('lta', 'yearly', lta);
      if (employee.countryFields.pfApplicable === true) {
        add('employer_pf', 'monthly', 0.12 * Math.min(basic, 25_000));
      }
      add('gratuity', 'monthly', basic * 0.0481);
      if (fullTime) add('performance_bonus', 'yearly', annual * profile.bonusShare);
      add('health_insurance', 'yearly', profile.healthCover);
      break;
    }
    case 'US': {
      add('base_salary', 'bi_weekly', annual / 26);
      add('employer_fica', 'bi_weekly', (0.062 * Math.min(annual, 184_500) + 0.0145 * annual) / 26);
      add('unemployment_insurance', 'yearly', profile.unemploymentPerYear);
      if (fullTime) {
        add('retirement_match', 'bi_weekly', (annual * profile.retirementMatchShare) / 26);
        add('health_insurance', 'monthly', profile.healthCover);
        if (employee.department === 'Sales') {
          add('commission', 'quarterly', (annual * profile.commissionShare) / 4);
        } else {
          add('bonus', 'yearly', annual * profile.bonusShare);
        }
      }
      break;
    }
    case 'CA': {
      add('base_salary', 'bi_weekly', annual / 26);
      if (!fullTime) add('vacation_pay', 'bi_weekly', (annual * 0.04) / 26);
      const cpp =
        0.0595 * Math.max(0, Math.min(annual, 74_600) - 3_500) +
        0.04 * Math.max(0, Math.min(annual, 85_000) - 74_600);
      add('employer_cpp', 'bi_weekly', cpp / 26);
      add('employer_ei', 'bi_weekly', (1.4 * 0.0163 * Math.min(annual, 68_900)) / 26);
      if (fullTime) {
        add('bonus', 'yearly', annual * profile.bonusShare);
        if (profile.hasRetirementMatch) {
          add('retirement_match', 'bi_weekly', (annual * profile.retirementMatchShare) / 26);
        }
        add('group_benefits', 'monthly', profile.healthCover);
      }
      break;
    }
    case 'AU': {
      add('base_salary', 'bi_weekly', annual / 26);
      add('superannuation', 'bi_weekly', (annual * 0.12) / 26);
      if (employee.countryFields.award !== undefined) {
        add('allowances', 'bi_weekly', profile.allowancePerPeriod);
      }
      add('leave_loading', 'yearly', (0.175 * annual * 4) / 52);
      if (fullTime && profile.hasBonus) add('bonus', 'yearly', annual * profile.bonusShare);
      break;
    }
  }
  return components;
}
