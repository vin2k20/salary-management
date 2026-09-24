import {
  changeLogResponseSchema,
  currentPayResponseSchema,
  employeeResponseSchema,
  payHistoryResponseSchema,
} from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { componentId, insertUser } from '../../test/fixtures.ts';
import { insertIndianWithPay, type IndianWithPay } from '../../test/pay-data.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('POST /api/employees/:id/transfer', () => {
  let globalCookie: string;
  let indiaCookie: string;
  let usBase: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    globalCookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
    indiaCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
    usBase = await componentId(db, 'base_salary', 'US');
  });

  async function app() {
    return (await createTestApp()).app;
  }

  function move(employee: IndianWithPay, body: Record<string, unknown> = {}) {
    return app().then((server) =>
      request(server)
        .post(`/api/employees/${employee.id}/transfer`)
        .set('Cookie', globalCookie)
        .send({
          countryCode: 'US',
          region: 'Texas',
          effectiveFrom: '2026-09-24',
          items: [{ componentId: usBase, amount: '4000', currency: 'USD', frequency: 'bi_weekly' }],
          ...body,
        }),
    );
  }

  async function get(path: string, cookie = globalCookie) {
    return request(await app())
      .get(path)
      .set('Cookie', cookie);
  }

  it("moves the employee and restarts pay in the new country's currency", async () => {
    const employee = await insertIndianWithPay({ countryFields: { pfApplicable: true } });

    const response = await move(employee);

    expect(response.status).toBe(200);
    expect(employeeResponseSchema.parse(response.body).employee).toMatchObject({
      countryCode: 'US',
      region: 'Texas',
      countryFields: {},
    });
    const pay = currentPayResponseSchema.parse(
      (await get(`/api/employees/${employee.id}/pay`)).body,
    );
    expect(pay.items.map((item) => [item.component.name, item.amount])).toEqual([
      ['Base salary or wages', { amountMinor: 400_000, currency: 'USD' }],
    ]);
    expect(pay.totals.annualTotal).toEqual({ amountMinor: 10_400_000, currency: 'USD' });
    const history = payHistoryResponseSchema.parse(
      (await get(`/api/employees/${employee.id}/pay-changes`)).body,
    );
    expect(history.items[0]).toMatchObject({ effectiveFrom: '2026-09-24', reason: 'transfer' });
    expect(
      history.items[0]?.lines.map((line) => [
        line.component.name,
        line.before?.amount.currency ?? null,
        line.after?.amount.currency ?? null,
      ]),
    ).toEqual([
      ['Base salary or wages', null, 'USD'],
      ['Basic', 'INR', null],
      ['House rent allowance', 'INR', null],
    ]);
  });

  it('records the move and the new pay in the change log', async () => {
    const employee = await insertIndianWithPay();
    await move(employee);

    const { items } = changeLogResponseSchema.parse(
      (await get(`/api/employees/${employee.id}/change-log`)).body,
    );

    expect(items.map((item) => [item.entityType, item.action]).sort()).toEqual([
      ['employee', 'transferred'],
      ['pay_change', 'created'],
    ]);
    expect(items.find((item) => item.action === 'transferred')?.changes).toMatchObject({
      countryCode: { old: 'IN', new: 'US' },
      region: { old: 'Karnataka', new: 'Texas' },
    });
  });

  it("leaves the old country's HR user unable to see the employee", async () => {
    const employee = await insertIndianWithPay();
    expect((await get(`/api/employees/${employee.id}`, indiaCookie)).status).toBe(200);

    await move(employee);

    expect((await get(`/api/employees/${employee.id}`, indiaCookie)).status).toBe(404);
  });

  it('cannot be dated in the future', async () => {
    const employee = await insertIndianWithPay();

    const response = await move(employee, { effectiveFrom: '2026-09-25' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      errors: [{ field: 'effectiveFrom', message: 'A move cannot be dated in the future' }],
    });
  });
});
