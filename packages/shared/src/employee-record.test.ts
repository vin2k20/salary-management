import { describe, expect, it } from 'vitest';
import {
  COUNTRY_FIELD_KEYS,
  createEmployeeRequestSchema,
  inactiveDateIssue,
  updateEmployeeRequestSchema,
} from './employee-record.ts';
import { REGIONS } from './regions.ts';

const valid = {
  employeeCode: ' in00042 ',
  firstName: ' Aarav ',
  lastName: 'Sharma',
  email: ' Aarav.Sharma@Acme.Example.com ',
  jobTitle: '  Senior   Software Engineer ',
  jobLevel: 'L4',
  department: 'Engineering',
  countryCode: 'IN',
  region: 'Karnataka',
  employmentType: 'full_time',
  fte: 1,
  hireDate: '2024-04-01',
  countryFields: { pfApplicable: true, esiApplicable: false },
};

function issues(input: unknown) {
  const result = createEmployeeRequestSchema.safeParse(input);
  return result.error?.issues.map((issue) => [issue.path.join('.'), issue.message]) ?? [];
}

describe('createEmployeeRequestSchema', () => {
  it('accepts a valid employee and tidies codes, names, emails and spacing', () => {
    expect(createEmployeeRequestSchema.parse(valid)).toEqual({
      ...valid,
      employeeCode: 'IN00042',
      firstName: 'Aarav',
      email: 'aarav.sharma@acme.example.com',
      jobTitle: 'Senior Software Engineer',
    });
  });

  it('treats an empty job level as not set and defaults the FTE to 1', () => {
    const { fte: _fte, ...withoutFte } = valid;

    expect(createEmployeeRequestSchema.parse({ ...withoutFte, jobLevel: '' })).toMatchObject({
      jobLevel: null,
      fte: 1,
    });
  });

  it('reports each missing or invalid field with a message', () => {
    expect(
      issues({
        ...valid,
        employeeCode: 'IN 42',
        firstName: ' ',
        email: 'not-an-email',
        fte: 0,
        hireDate: '2024-02-30',
        employmentType: 'seasonal',
      }),
    ).toEqual([
      ['employeeCode', 'Use letters, digits and hyphens only'],
      ['firstName', 'Enter a first name'],
      ['email', 'Enter a valid email address'],
      ['employmentType', 'Choose an employment type'],
      ['fte', 'Enter an FTE above 0 and up to 1'],
      ['hireDate', 'Enter a valid date'],
    ]);
  });

  it('allows FTE values with up to three decimals only', () => {
    expect(issues({ ...valid, fte: 0.5 })).toEqual([]);
    expect(issues({ ...valid, fte: 0.8125 })).toEqual([['fte', 'Use at most three decimals']]);
  });

  it("requires a region from the employee's country", () => {
    expect(issues({ ...valid, region: 'Texas' })).toEqual([
      ['region', 'Choose a state or union territory in India'],
    ]);
    expect(issues({ ...valid, region: '' })).toEqual([
      ['region', 'Choose a state or union territory in India'],
    ]);
  });

  it('checks the region even when other fields are missing', () => {
    expect(issues({ countryCode: 'IN', region: 'Texas' })).toContainEqual([
      'region',
      'Choose a state or union territory in India',
    ]);
  });

  it('accepts only the country-specific fields of the chosen country', () => {
    expect(
      issues({
        ...valid,
        countryCode: 'US',
        region: 'Texas',
        countryFields: { flsaStatus: 'exempt' },
      }),
    ).toEqual([]);
    expect(
      issues({
        ...valid,
        countryCode: 'AU',
        region: 'Victoria',
        countryFields: { award: 'Clerks - Private Sector Award 2020' },
      }),
    ).toEqual([]);
    expect(issues({ ...valid, countryCode: 'CA', region: 'Ontario', countryFields: {} })).toEqual(
      [],
    );

    expect(
      issues({ ...valid, countryCode: 'US', region: 'Texas', countryFields: { award: 'Retail' } }),
    ).toEqual([['countryFields.award', 'Not used for employees in United States']]);
    expect(
      issues({ ...valid, countryCode: 'US', region: 'Texas', countryFields: { flsaStatus: 'x' } }),
    ).toEqual([['countryFields.flsaStatus', 'Choose exempt or non-exempt']]);
    expect(issues({ ...valid, countryFields: { pfApplicable: 'yes' } })).toEqual([
      ['countryFields.pfApplicable', 'Choose yes or no'],
    ]);
  });

  it('drops empty optional country fields', () => {
    const parsed = createEmployeeRequestSchema.parse({
      ...valid,
      countryCode: 'AU',
      region: 'Victoria',
      countryFields: { award: '  ' },
    });

    expect(parsed.countryFields).toEqual({});
  });

  it('never accepts a status or inactive date for a new employee', () => {
    expect(createEmployeeRequestSchema.parse({ ...valid, status: 'inactive' })).not.toHaveProperty(
      'status',
    );
  });
});

describe('updateEmployeeRequestSchema', () => {
  it('accepts any subset of the editable fields', () => {
    expect(updateEmployeeRequestSchema.parse({ jobTitle: ' Staff  Engineer ' })).toEqual({
      jobTitle: 'Staff Engineer',
    });
    expect(
      updateEmployeeRequestSchema.parse({ status: 'inactive', inactiveOn: '2026-09-30' }),
    ).toEqual({ status: 'inactive', inactiveOn: '2026-09-30' });
  });

  it('rejects an empty change', () => {
    expect(updateEmployeeRequestSchema.safeParse({}).error?.issues[0]?.message).toBe(
      'Nothing to change',
    );
  });

  it('does not change the employee code or country, which have their own rules', () => {
    expect(
      updateEmployeeRequestSchema.parse({ employeeCode: 'X1', countryCode: 'US', firstName: 'A' }),
    ).toEqual({ firstName: 'A' });
  });
});

describe('inactiveDateIssue', () => {
  it('accepts a date from the hire date up to today', () => {
    expect(inactiveDateIssue('2024-04-01', '2024-04-01', '2026-09-24')).toBeNull();
    expect(inactiveDateIssue('2024-04-01', '2026-09-24', '2026-09-24')).toBeNull();
  });

  it('rejects dates before the hire date or in the future', () => {
    expect(inactiveDateIssue('2024-04-01', '2024-03-31', '2026-09-24')).toBe(
      'The inactive date cannot be before the hire date',
    );
    expect(inactiveDateIssue('2024-04-01', '2026-09-25', '2026-09-24')).toBe(
      'The inactive date cannot be in the future',
    );
  });
});

describe('REGIONS and COUNTRY_FIELD_KEYS', () => {
  it('list every state, province or territory of the four countries', () => {
    expect(REGIONS.US).toHaveLength(51);
    expect(REGIONS.CA).toHaveLength(13);
    expect(REGIONS.AU).toHaveLength(8);
    expect(REGIONS.IN).toHaveLength(36);
  });

  it('name the country-specific fields of each country', () => {
    expect(COUNTRY_FIELD_KEYS).toEqual({
      US: ['flsaStatus'],
      CA: [],
      AU: ['award'],
      IN: ['pfApplicable', 'esiApplicable'],
    });
  });
});
