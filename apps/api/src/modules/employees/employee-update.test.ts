import { employeeListResponseSchema, employeeResponseSchema } from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertEmployee, insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('PATCH /api/employees/:id', () => {
  let cookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    cookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
  });

  async function patch(id: string, body: Record<string, unknown>) {
    const { app } = await createTestApp();
    return request(app).patch(`/api/employees/${id}`).set('Cookie', cookie).send(body);
  }

  async function usEmployee() {
    const { db } = await sharedTestDatabase();
    return insertEmployee(db, {
      countryCode: 'US',
      region: 'Texas',
      hireDate: '2024-04-01',
      countryFields: { flsaStatus: 'exempt' },
    });
  }

  it('changes the details sent and keeps the others', async () => {
    const employee = await usEmployee();

    const response = await patch(employee.id, {
      jobTitle: '  Senior   Software Engineer ',
      region: 'California',
      fte: 0.8,
      employmentType: 'part_time',
      countryFields: { flsaStatus: 'non_exempt' },
    });

    expect(response.status).toBe(200);
    expect(employeeResponseSchema.parse(response.body).employee).toMatchObject({
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      jobTitle: 'Senior Software Engineer',
      region: 'California',
      fte: 0.8,
      employmentType: 'part_time',
      countryFields: { flsaStatus: 'non_exempt' },
    });
  });

  it("checks the region and country fields against the employee's country", async () => {
    const employee = await usEmployee();

    const response = await patch(employee.id, {
      region: 'Ontario',
      countryFields: { pfApplicable: true },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      errors: [
        { field: 'region', message: 'Choose a state in United States' },
        {
          field: 'countryFields.pfApplicable',
          message: 'Not used for employees in United States',
        },
      ],
    });
  });

  it('rejects an empty change', async () => {
    const employee = await usEmployee();

    expect((await patch(employee.id, {})).status).toBe(400);
  });

  it('answers 404 for an unknown employee', async () => {
    expect((await patch('4f0c8a36-7c55-4c7f-9d52-1c8f6b8f5e21', { lastName: 'X' })).status).toBe(
      404,
    );
  });

  describe('marking an employee inactive', () => {
    it('keeps the record with its inactive date and leaves it out of the directory', async () => {
      const employee = await usEmployee();

      const response = await patch(employee.id, { status: 'inactive', inactiveOn: '2026-09-15' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        employee: { status: 'inactive', inactiveOn: '2026-09-15', lastName: employee.lastName },
      });
      const { app } = await createTestApp();
      const list = await request(app)
        .get('/api/employees')
        .query({ search: employee.employeeCode })
        .set('Cookie', cookie);
      expect(employeeListResponseSchema.parse(list.body).total).toBe(0);
    });

    it('uses today when no date is given', async () => {
      const employee = await usEmployee();

      const response = await patch(employee.id, { status: 'inactive' });

      expect(response.body).toMatchObject({ employee: { inactiveOn: '2026-09-24' } });
    });

    it('rejects a date before the hire date or in the future', async () => {
      const employee = await usEmployee();

      const early = await patch(employee.id, { status: 'inactive', inactiveOn: '2024-03-31' });
      const future = await patch(employee.id, { status: 'inactive', inactiveOn: '2026-09-25' });

      expect(early.body).toMatchObject({
        errors: [
          { field: 'inactiveOn', message: 'The inactive date cannot be before the hire date' },
        ],
      });
      expect(future.body).toMatchObject({
        errors: [{ field: 'inactiveOn', message: 'The inactive date cannot be in the future' }],
      });
    });

    it('clears the inactive date when the employee is made active again', async () => {
      const employee = await usEmployee();
      await patch(employee.id, { status: 'inactive', inactiveOn: '2026-09-01' });

      const response = await patch(employee.id, { status: 'active' });

      expect(response.body).toMatchObject({ employee: { status: 'active', inactiveOn: null } });
    });

    it('does not give an active employee an inactive date', async () => {
      const employee = await usEmployee();

      const response = await patch(employee.id, { inactiveOn: '2026-09-01' });

      expect(response.body).toMatchObject({
        errors: [{ field: 'inactiveOn', message: 'Only inactive employees have an inactive date' }],
      });
    });
  });
});
