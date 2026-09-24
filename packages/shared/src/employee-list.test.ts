import { describe, expect, it } from 'vitest';
import { employeeListQuerySchema } from './employee-list.ts';

describe('employeeListQuerySchema', () => {
  it('fills in defaults for an empty query', () => {
    expect(employeeListQuerySchema.parse({})).toEqual({
      includeInactive: false,
      sort: 'name',
      page: 1,
      pageSize: 50,
      currency: 'local',
    });
  });

  it('reads filters, sorting and paging from query strings', () => {
    expect(
      employeeListQuerySchema.parse({
        search: ' sharma ',
        country: 'IN',
        region: 'Karnataka',
        department: 'Engineering',
        jobTitle: 'Software Engineer',
        employmentType: 'full_time',
        includeInactive: 'true',
        sort: '-annualTotal',
        page: '3',
        pageSize: '25',
        currency: 'USD',
      }),
    ).toEqual({
      search: 'sharma',
      country: 'IN',
      region: 'Karnataka',
      department: 'Engineering',
      jobTitle: 'Software Engineer',
      employmentType: 'full_time',
      includeInactive: true,
      sort: '-annualTotal',
      page: 3,
      pageSize: 25,
      currency: 'USD',
    });
  });

  it('treats empty values as not set', () => {
    expect(employeeListQuerySchema.parse({ search: '', country: '', department: '' })).toEqual(
      employeeListQuerySchema.parse({}),
    );
  });

  it('rejects unknown sort fields, countries and page sizes over 100', () => {
    expect(employeeListQuerySchema.safeParse({ sort: 'salary' }).success).toBe(false);
    expect(employeeListQuerySchema.safeParse({ country: 'GB' }).success).toBe(false);
    expect(employeeListQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});
