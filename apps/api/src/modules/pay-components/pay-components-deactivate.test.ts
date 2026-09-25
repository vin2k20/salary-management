import {
  currentPayResponseSchema,
  payComponentListResponseSchema,
  payComponentResponseSchema,
} from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { insertIndianWithPay } from '../../test/pay-data.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('deactivated pay components', () => {
  let cookie: string;
  let mealCard: string;

  async function app() {
    return (await createTestApp()).app;
  }

  function payChange(employeeId: string, body: Record<string, unknown>) {
    return app().then((server) =>
      request(server)
        .post(`/api/employees/${employeeId}/pay-changes`)
        .set('Cookie', cookie)
        .send({ effectiveFrom: '2026-09-01', reason: 'revision', ...body }),
    );
  }

  function setActive(isActive: boolean) {
    return app().then((server) =>
      request(server)
        .patch(`/api/pay-components/${mealCard}`)
        .set('Cookie', cookie)
        .send({ isActive }),
    );
  }

  const mealCardLine = () => ({
    componentId: mealCard,
    amount: '2200',
    currency: 'INR',
    frequency: 'monthly',
  });

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    cookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
    const created = await request(await app())
      .post('/api/pay-components')
      .set('Cookie', cookie)
      .send({
        code: 'meal_card',
        name: 'Meal card',
        category: 'allowance',
        countryCode: 'IN',
        defaultFrequency: 'monthly',
      });
    mealCard = payComponentResponseSchema.parse(created.body).component.id;
  });

  it('stay on existing pay, but cannot be used in new pay changes', async () => {
    const paid = await insertIndianWithPay();
    expect((await payChange(paid.id, { set: [mealCardLine()] })).status).toBe(201);

    const response = await setActive(false);

    expect(response.status).toBe(200);
    expect(payComponentResponseSchema.parse(response.body).component.isActive).toBe(false);
    const pay = currentPayResponseSchema.parse(
      (
        await request(await app())
          .get(`/api/employees/${paid.id}/pay`)
          .set('Cookie', cookie)
      ).body,
    );
    expect(pay.items.map((item) => item.component.name)).toContain('Meal card');

    const other = await insertIndianWithPay();
    const refused = await payChange(other.id, { set: [mealCardLine()] });
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject({
      errors: [{ field: 'set.0.componentId', message: 'Meal card is no longer in use' }],
    });

    const list = payComponentListResponseSchema.parse(
      (
        await request(await app())
          .get('/api/pay-components')
          .set('Cookie', cookie)
      ).body,
    );
    expect(list.items.find((item) => item.id === mealCard)?.isActive).toBe(false);
    await setActive(true);
  });

  it('can still be ended, and used again once reactivated', async () => {
    const paid = await insertIndianWithPay();
    await payChange(paid.id, { set: [mealCardLine()] });
    await setActive(false);

    const ended = await request(await app())
      .post(`/api/employees/${paid.id}/pay-changes`)
      .set('Cookie', cookie)
      .send({ effectiveFrom: '2026-09-10', reason: 'correction', end: [mealCard] });
    await setActive(true);
    const other = await insertIndianWithPay();
    const reused = await payChange(other.id, { set: [mealCardLine()] });

    expect([ended.status, reused.status]).toEqual([201, 201]);
  });
});
