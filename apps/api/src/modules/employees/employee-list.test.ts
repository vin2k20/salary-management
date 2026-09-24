import { employeeListResponseSchema, type EmployeeListResponse } from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertDirectoryData } from '../../test/directory-data.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('GET /api/employees', () => {
  let cookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    await insertDirectoryData(db);
    cookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
  });

  async function list(query: Record<string, string> = {}): Promise<EmployeeListResponse> {
    const { app } = await createTestApp();
    const response = await request(app).get('/api/employees').query(query).set('Cookie', cookie);
    expect(response.status).toBe(200);
    return employeeListResponseSchema.parse(response.body);
  }

  const codes = (body: EmployeeListResponse) => body.items.map((item) => item.employeeCode);

  it('lists active employees by name with annual and monthly totals in local currency', async () => {
    const body = await list();

    expect(codes(body)).toEqual(['US90002', 'IN90001', 'IN90002', 'US90001', 'CA90001']);
    expect(body).toMatchObject({
      page: 1,
      pageSize: 50,
      total: 5,
      currency: 'local',
      rateDate: null,
    });
    expect(body.items[1]).toEqual({
      id: expect.any(String) as unknown,
      employeeCode: 'IN90001',
      firstName: 'Aarav',
      lastName: 'Sharma',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      countryCode: 'IN',
      region: 'Karnataka',
      employmentType: 'full_time',
      status: 'active',
      annualTotal: { amountMinor: 120_000_000, currency: 'INR' },
      monthlyTotal: { amountMinor: 10_000_000, currency: 'INR' },
    });
  });

  it('finds employees by part of their name or the start of their code', async () => {
    expect(codes(await list({ search: 'SHARM' }))).toEqual(['IN90001', 'IN90002']);
    expect(codes(await list({ search: 'aarav sha' }))).toEqual(['IN90001']);
    expect(codes(await list({ search: 'us9000' }))).toEqual(['US90002', 'US90001']);
    expect(codes(await list({ search: '100%_' }))).toEqual([]);
  });

  it('filters by country, region, department, job title and employment type', async () => {
    expect(codes(await list({ country: 'US' }))).toEqual(['US90002', 'US90001']);
    expect(codes(await list({ region: 'Ontario' }))).toEqual(['CA90001']);
    expect(codes(await list({ country: 'IN', department: 'Engineering' }))).toEqual(['IN90001']);
    expect(codes(await list({ jobTitle: 'Account Executive' }))).toEqual(['US90002', 'IN90002']);
    expect(codes(await list({ employmentType: 'contractor' }))).toEqual(['US90002']);
  });

  it('sorts by annual total compared in US dollars, whatever the display currency', async () => {
    // 130,000 USD; 96,000 USD; 104,000 CAD = 73,670 USD; 1.2m INR = 12,505 USD; 0.6m INR.
    const expected = ['US90001', 'US90002', 'CA90001', 'IN90001', 'IN90002'];
    expect(codes(await list({ sort: '-annualTotal' }))).toEqual(expected);
    expect(codes(await list({ sort: 'annualTotal', currency: 'USD' }))).toEqual(
      [...expected].reverse(),
    );
  });

  it('converts totals to US dollars and says which rates were used', async () => {
    const body = await list({ currency: 'USD', country: 'IN', sort: 'employeeCode' });

    expect(body).toMatchObject({ currency: 'USD', rateDate: '2026-09-24' });
    expect(body.items[0]).toMatchObject({
      annualTotal: { amountMinor: 1_250_521, currency: 'USD' },
      monthlyTotal: { amountMinor: 104_210, currency: 'USD' },
    });
  });

  it('pages through the results with a stable order', async () => {
    const body = await list({ sort: '-annualTotal', page: '2', pageSize: '2' });

    expect(codes(body)).toEqual(['CA90001', 'IN90001']);
    expect(body).toMatchObject({ page: 2, pageSize: 2, total: 5 });
  });

  it('hides inactive employees unless they are included', async () => {
    expect(codes(await list({ search: 'mehta' }))).toEqual([]);

    const body = await list({ search: 'mehta', includeInactive: 'true' });

    expect(body.items).toEqual([
      expect.objectContaining({ employeeCode: 'IN90003', status: 'inactive' }),
    ]);
  });

  it('returns 400 for an invalid query', async () => {
    const { app } = await createTestApp();

    const response = await request(app)
      .get('/api/employees')
      .query({ sort: 'salary', pageSize: '1000' })
      .set('Cookie', cookie);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      errors: [
        { field: 'sort', message: 'Unknown sort field' },
        { field: 'pageSize', message: expect.any(String) as unknown },
      ],
    });
  });
});
