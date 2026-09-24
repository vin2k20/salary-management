import {
  changeLogResponseSchema,
  employeeDetailResponseSchema,
  employeeListResponseSchema,
  employeeResponseSchema,
  payHistoryResponseSchema,
} from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { componentId, insertUser, newEmployeeRequest } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('starting pay for a new employee', () => {
  let cookie: string;
  let basic: string;
  let hra: string;
  let usBase: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    cookie = await sessionCookieFor(await insertUser(db));
    [basic, hra, usBase] = await Promise.all([
      componentId(db, 'basic', 'IN'),
      componentId(db, 'hra', 'IN'),
      componentId(db, 'base_salary', 'US'),
    ]);
  });

  async function app() {
    return (await createTestApp()).app;
  }

  async function create(body: Record<string, unknown>) {
    return request(await app())
      .post('/api/employees')
      .set('Cookie', cookie)
      .send(body);
  }

  async function get(path: string) {
    return request(await app())
      .get(path)
      .set('Cookie', cookie);
  }

  it('starts on the hire date as a pay change with the reason "hire"', async () => {
    const response = await create(
      newEmployeeRequest({
        hireDate: '2025-06-02',
        startingPay: [
          { componentId: basic, amount: '50000', currency: 'INR', frequency: 'monthly' },
          { componentId: hra, amount: '20000', currency: 'INR', frequency: 'monthly' },
        ],
      }),
    );

    expect(response.status).toBe(201);
    const { employee } = employeeResponseSchema.parse(response.body);
    const history = payHistoryResponseSchema.parse(
      (await get(`/api/employees/${employee.id}/pay-changes`)).body,
    );
    expect(history.items.map((item) => [item.effectiveFrom, item.reason])).toEqual([
      ['2025-06-02', 'hire'],
    ]);
    const detail = employeeDetailResponseSchema.parse(
      (await get(`/api/employees/${employee.id}`)).body,
    );
    expect(detail.payTotals.annualTotal).toEqual({ amountMinor: 84_000_000, currency: 'INR' });
    const log = changeLogResponseSchema.parse(
      (await get(`/api/employees/${employee.id}/change-log`)).body,
    );
    expect(log.items.map((item) => [item.entityType, item.action]).sort()).toEqual([
      ['employee', 'created'],
      ['pay_change', 'created'],
    ]);
  });

  it('can be left out and added later', async () => {
    const response = await create(newEmployeeRequest());

    expect(response.status).toBe(201);
    const { employee } = employeeResponseSchema.parse(response.body);
    const history = payHistoryResponseSchema.parse(
      (await get(`/api/employees/${employee.id}/pay-changes`)).body,
    );
    expect(history.items).toEqual([]);
  });

  it("saves nothing when a component is not used in the employee's country", async () => {
    const body = newEmployeeRequest({
      startingPay: [{ componentId: usBase, amount: '4000', currency: 'INR', frequency: 'monthly' }],
    });

    const response = await create(body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      errors: [
        {
          field: 'startingPay.0.componentId',
          message: 'Base salary or wages is not used in India',
        },
      ],
    });
    const list = employeeListResponseSchema.parse(
      (await get(`/api/employees?search=${body.employeeCode}&includeInactive=true`)).body,
    );
    expect(list.total).toBe(0);
  });
});
