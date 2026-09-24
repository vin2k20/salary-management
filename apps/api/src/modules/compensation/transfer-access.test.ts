import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { componentId, insertUser } from '../../test/fixtures.ts';
import { insertIndianWithPay } from '../../test/pay-data.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('who can move employees between countries', () => {
  let usBase: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    usBase = await componentId(db, 'base_salary', 'US');
  });

  async function move(employeeId: string, cookie: string) {
    const { app } = await createTestApp();
    return request(app)
      .post(`/api/employees/${employeeId}/transfer`)
      .set('Cookie', cookie)
      .send({
        countryCode: 'US',
        region: 'Texas',
        effectiveFrom: '2026-09-24',
        items: [{ componentId: usBase, amount: '4000', currency: 'USD', frequency: 'bi_weekly' }],
      });
  }

  it('is only global HR users, even for employees in the country HR user country', async () => {
    const { db } = await sharedTestDatabase();
    const indiaCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
    const employee = await insertIndianWithPay();

    const response = await move(employee.id, indiaCookie);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      detail: 'Only global HR users can move employees between countries',
    });
  });

  it('does not move inactive employees', async () => {
    const { db } = await sharedTestDatabase();
    const globalCookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
    const employee = await insertIndianWithPay({ status: 'inactive', inactiveOn: '2026-06-30' });

    const response = await move(employee.id, globalCookie);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      detail: 'Mark the employee active before moving them',
    });
  });
});
