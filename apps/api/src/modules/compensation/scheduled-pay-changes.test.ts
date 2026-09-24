import {
  currentPayResponseSchema,
  employeeDetailResponseSchema,
  payHistoryResponseSchema,
} from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { insertIndianWithPay, type IndianWithPay } from '../../test/pay-data.ts';
import { createTestApp, sharedTestDatabase, testClock } from '../../test/test-app.ts';

describe('future-dated pay changes', () => {
  let user: Awaited<ReturnType<typeof insertUser>>;
  let employee: IndianWithPay;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    user = await insertUser(db);
    employee = await insertIndianWithPay();
    const response = await request((await createTestApp()).app)
      .post(`/api/employees/${employee.id}/pay-changes`)
      .set('Cookie', await sessionCookieFor(user))
      .send({
        effectiveFrom: '2026-12-01',
        reason: 'revision',
        set: [
          { componentId: employee.basic, amount: '60000', currency: 'INR', frequency: 'monthly' },
        ],
      });
    expect(response.status).toBe(201);
  });

  /** Reads an endpoint as if today were the given date. */
  async function getOn(date: string, path: string) {
    const clock = testClock(`${date}T10:00:00Z`);
    const { app } = await createTestApp({ clock });
    return request(app)
      .get(path)
      .set('Cookie', await sessionCookieFor(user, { clock }));
  }

  it('leave current pay and totals as they are until their date', async () => {
    const pay = currentPayResponseSchema.parse(
      (await getOn('2026-09-24', `/api/employees/${employee.id}/pay`)).body,
    );
    const detail = employeeDetailResponseSchema.parse(
      (await getOn('2026-09-24', `/api/employees/${employee.id}`)).body,
    );

    expect(pay.items.map((item) => [item.component.name, item.amount.amountMinor])).toEqual([
      ['Basic', 5_000_000],
      ['House rent allowance', 2_000_000],
    ]);
    expect(detail.payTotals.annualTotal.amountMinor).toBe(84_000_000);
  });

  it('apply from their date', async () => {
    const pay = currentPayResponseSchema.parse(
      (await getOn('2026-12-01', `/api/employees/${employee.id}/pay`)).body,
    );

    expect(pay.items.map((item) => [item.component.name, item.amount.amountMinor])).toEqual([
      ['Basic', 6_000_000],
      ['House rent allowance', 2_000_000],
    ]);
    expect(pay.totals.annualTotal.amountMinor).toBe(96_000_000);
  });

  it('are shown as scheduled in the history', async () => {
    const history = payHistoryResponseSchema.parse(
      (await getOn('2026-09-24', `/api/employees/${employee.id}/pay-changes`)).body,
    );

    expect(history.items.map((item) => [item.effectiveFrom, item.scheduled])).toEqual([
      ['2026-12-01', true],
      ['2025-01-01', false],
    ]);
  });

  it('must be followed only by changes dated after them', async () => {
    const response = await request((await createTestApp()).app)
      .post(`/api/employees/${employee.id}/pay-changes`)
      .set('Cookie', await sessionCookieFor(user))
      .send({ effectiveFrom: '2026-11-01', reason: 'correction', end: [employee.hra] });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      errors: [
        { field: 'effectiveFrom', message: "Choose a date after the employee's last pay change" },
      ],
    });
  });
});
