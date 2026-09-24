import { employeeResponseSchema } from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import {
  insertEmployee,
  insertUser,
  newEmployeeRequest as newEmployee,
} from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('employee records', () => {
  let cookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    cookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
  });

  async function create(body: Record<string, unknown>) {
    const { app } = await createTestApp();
    return request(app).post('/api/employees').set('Cookie', cookie).send(body);
  }

  async function read(id: string) {
    const { app } = await createTestApp();
    return request(app).get(`/api/employees/${id}`).set('Cookie', cookie);
  }

  describe('POST /api/employees', () => {
    it.each([
      ['IN', 'Maharashtra', { pfApplicable: false, esiApplicable: true }],
      ['US', 'Texas', { flsaStatus: 'non_exempt' }],
      ['CA', 'Quebec', {}],
      ['AU', 'Victoria', { award: 'Clerks - Private Sector Award 2020' }],
    ])('adds an active employee in %s with its own fields', async (country, region, fields) => {
      const body = newEmployee({ countryCode: country, region, countryFields: fields });

      const response = await create(body);

      expect(response.status).toBe(201);
      const { employee } = employeeResponseSchema.parse(response.body);
      expect(employee).toMatchObject({
        ...body,
        status: 'active',
        inactiveOn: null,
        countryFields: fields,
      });
      const fetched = await read(employee.id);
      expect(fetched.status).toBe(200);
      expect(employeeResponseSchema.parse(fetched.body).employee).toEqual(employee);
    });

    it('tidies the code and reuses the stored casing of known job titles and departments', async () => {
      const { db } = await sharedTestDatabase();
      await insertEmployee(db, { jobTitle: 'Head of Data', department: 'Data' });

      const response = await create(
        newEmployee({
          employeeCode: ' rec-lower-1 ',
          jobTitle: ' head  OF data ',
          department: 'DATA',
        }),
      );

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        employee: { employeeCode: 'REC-LOWER-1', jobTitle: 'Head of Data', department: 'Data' },
      });
    });

    it('keeps a new job title as typed, without extra spaces', async () => {
      const response = await create(newEmployee({ jobTitle: '  Platform   Wrangler ' }));

      expect(response.body).toMatchObject({ employee: { jobTitle: 'Platform Wrangler' } });
    });

    it("rejects regions and fields that do not belong to the employee's country", async () => {
      const response = await create(
        newEmployee({ countryCode: 'US', region: 'Karnataka', countryFields: { award: 'X' } }),
      );

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        errors: [
          { field: 'region', message: 'Choose a state in United States' },
          { field: 'countryFields.award', message: 'Not used for employees in United States' },
        ],
      });
    });

    it('rejects a duplicate employee code, whatever its case', async () => {
      const first = await create(newEmployee({ employeeCode: 'REC-DUP-1' }));
      const second = await create(newEmployee({ employeeCode: 'rec-dup-1' }));

      expect(first.status).toBe(201);
      expect(second.status).toBe(409);
      expect(second.body).toMatchObject({
        detail: 'An employee with the code REC-DUP-1 already exists',
      });
    });
  });

  describe('GET /api/employees/:id', () => {
    it('answers 404 for an unknown or malformed ID', async () => {
      expect((await read('4f0c8a36-7c55-4c7f-9d52-1c8f6b8f5e21')).status).toBe(404);
      expect((await read('not-an-id')).status).toBe(404);
    });
  });
});
