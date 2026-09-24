import {
  changeLogResponseSchema,
  currentPayResponseSchema,
  employeeDetailResponseSchema,
  payHistoryResponseSchema,
} from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';
import { insertIndianWithPay, type IndianWithPay } from '../../test/pay-data.ts';

describe('pay changes', () => {
  let cookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    cookie = await sessionCookieFor(await insertUser(db, { name: 'Grace Global' }));
  });

  async function app() {
    return (await createTestApp()).app;
  }

  async function change(employee: IndianWithPay, body: Record<string, unknown>) {
    return request(await app())
      .post(`/api/employees/${employee.id}/pay-changes`)
      .set('Cookie', cookie)
      .send(body);
  }

  async function currentPay(employee: IndianWithPay) {
    const response = await request(await app())
      .get(`/api/employees/${employee.id}/pay`)
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    return currentPayResponseSchema.parse(response.body);
  }

  function inr(amountMinor: number) {
    return { amountMinor, currency: 'INR' };
  }

  it('ends changed items and starts new ones, and the totals follow', async () => {
    const employee = await insertIndianWithPay();

    const response = await change(employee, {
      effectiveFrom: '2026-09-01',
      reason: 'revision',
      set: [
        { componentId: employee.basic, amount: '55000', currency: 'INR', frequency: 'monthly' },
        { componentId: employee.lta, amount: '40000', currency: 'INR', frequency: 'yearly' },
      ],
      end: [employee.hra],
    });

    expect(response.status).toBe(201);
    const pay = await currentPay(employee);
    expect(pay.asOf).toBe('2026-09-24');
    expect(
      pay.items.map((item) => [
        item.component.name,
        item.amount,
        item.frequency,
        item.annualAmount,
      ]),
    ).toEqual([
      ['Basic', inr(5_500_000), 'monthly', inr(66_000_000)],
      ['Leave travel allowance', inr(4_000_000), 'yearly', inr(4_000_000)],
    ]);
    // 550,000 x 12 + 40,000 = 700,000 a year; a month is 58,333.33 after rounding half to even.
    expect(pay.totals).toEqual({
      annualTotal: inr(70_000_000),
      monthlyTotal: inr(5_833_333),
      annualGross: inr(70_000_000),
      monthlyGross: inr(5_833_333),
    });
    const detail = await request(await app())
      .get(`/api/employees/${employee.id}`)
      .set('Cookie', cookie);
    expect(employeeDetailResponseSchema.parse(detail.body).payTotals).toEqual(pay.totals);
  });

  it('keeps the history, newest first, with what each change did', async () => {
    const employee = await insertIndianWithPay();
    await change(employee, {
      effectiveFrom: '2026-09-01',
      reason: 'promotion',
      note: 'Promoted to L3',
      set: [
        { componentId: employee.basic, amount: '55000', currency: 'INR', frequency: 'monthly' },
        { componentId: employee.lta, amount: '40000', currency: 'INR', frequency: 'yearly' },
      ],
      end: [employee.hra],
    });

    const response = await request(await app())
      .get(`/api/employees/${employee.id}/pay-changes`)
      .set('Cookie', cookie);

    const { items } = payHistoryResponseSchema.parse(response.body);
    expect(items.map((item) => [item.effectiveFrom, item.reason, item.scheduled])).toEqual([
      ['2026-09-01', 'promotion', false],
      ['2025-01-01', 'hire', false],
    ]);
    expect(items[0]).toMatchObject({ note: 'Promoted to L3', createdBy: { name: 'Grace Global' } });
    expect(items[0]?.lines.map((line) => [line.component.name, line.before, line.after])).toEqual([
      [
        'Basic',
        { amount: inr(5_000_000), frequency: 'monthly' },
        { amount: inr(5_500_000), frequency: 'monthly' },
      ],
      ['House rent allowance', { amount: inr(2_000_000), frequency: 'monthly' }, null],
      ['Leave travel allowance', null, { amount: inr(4_000_000), frequency: 'yearly' }],
    ]);
    expect(items[1]?.lines.map((line) => [line.component.name, line.before])).toEqual([
      ['Basic', null],
      ['House rent allowance', null],
    ]);
  });

  it('writes each pay change to the employee change log', async () => {
    const employee = await insertIndianWithPay();
    await change(employee, {
      effectiveFrom: '2026-09-01',
      reason: 'revision',
      set: [
        { componentId: employee.basic, amount: '55000', currency: 'INR', frequency: 'monthly' },
      ],
      end: [employee.hra],
    });

    const response = await request(await app())
      .get(`/api/employees/${employee.id}/change-log`)
      .set('Cookie', cookie);

    const { items } = changeLogResponseSchema.parse(response.body);
    expect(items[0]).toMatchObject({
      entityType: 'pay_change',
      action: 'created',
      changedBy: { name: 'Grace Global' },
      changes: {
        effectiveFrom: { old: null, new: '2026-09-01' },
        reason: { old: null, new: 'revision' },
        Basic: {
          old: { amountMinor: 5_000_000, currency: 'INR', frequency: 'monthly' },
          new: { amountMinor: 5_500_000, currency: 'INR', frequency: 'monthly' },
        },
        'House rent allowance': {
          old: { amountMinor: 2_000_000, currency: 'INR', frequency: 'monthly' },
          new: null,
        },
      },
    });
  });

  it("rejects pay in another currency than the employee's country", async () => {
    const employee = await insertIndianWithPay();

    const response = await change(employee, {
      effectiveFrom: '2026-09-01',
      reason: 'revision',
      set: [{ componentId: employee.basic, amount: '600', currency: 'USD', frequency: 'monthly' }],
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      errors: [{ field: 'set.0.currency', message: 'Pay for employees in India is in INR' }],
    });
  });

  it('does not change the pay of inactive employees', async () => {
    const employee = await insertIndianWithPay({ status: 'inactive', inactiveOn: '2026-06-30' });

    const response = await change(employee, {
      effectiveFrom: '2026-09-01',
      reason: 'correction',
      end: [employee.hra],
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      detail: 'Mark the employee active before changing their pay',
    });
  });

  it('answers 404 to country HR users for employees in other countries', async () => {
    const { db } = await sharedTestDatabase();
    const usCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'US' }),
    );
    const employee = await insertIndianWithPay();

    const responses = await Promise.all([
      request(await app())
        .get(`/api/employees/${employee.id}/pay`)
        .set('Cookie', usCookie),
      request(await app())
        .get(`/api/employees/${employee.id}/pay-changes`)
        .set('Cookie', usCookie),
      request(await app())
        .post(`/api/employees/${employee.id}/pay-changes`)
        .set('Cookie', usCookie)
        .send({ effectiveFrom: '2026-09-01', reason: 'revision', end: [employee.hra] }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
  });
});
