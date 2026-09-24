import { changeLogResponseSchema, employeeResponseSchema } from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertEmployee, insertUser, newEmployeeRequest } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase, testClock } from '../../test/test-app.ts';

describe('GET /api/employees/:id/change-log', () => {
  const clock = testClock();
  let cookie: string;
  let indiaCookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    cookie = await sessionCookieFor(
      await insertUser(db, { name: 'Grace Global', role: 'global_hr' }),
      { clock },
    );
    indiaCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
      { clock },
    );
  });

  async function app() {
    return (await createTestApp({ clock })).app;
  }

  async function changeLogOf(id: string, sessionCookie = cookie) {
    return request(await app())
      .get(`/api/employees/${id}/change-log`)
      .set('Cookie', sessionCookie);
  }

  it('records who added, changed and inactivated an employee, newest first', async () => {
    const created = await request(await app())
      .post('/api/employees')
      .set('Cookie', cookie)
      .send(
        newEmployeeRequest({
          countryCode: 'US',
          region: 'Texas',
          jobLevel: null,
          countryFields: { flsaStatus: 'exempt' },
        }),
      );
    const { employee } = employeeResponseSchema.parse(created.body);
    clock.advance(60_000);
    await request(await app())
      .patch(`/api/employees/${employee.id}`)
      .set('Cookie', cookie)
      .send({ jobTitle: 'Senior Software Engineer', countryFields: { flsaStatus: 'non_exempt' } });
    clock.advance(60_000);
    await request(await app())
      .patch(`/api/employees/${employee.id}`)
      .set('Cookie', cookie)
      .send({ status: 'inactive', inactiveOn: '2026-09-20' });

    const response = await changeLogOf(employee.id);

    expect(response.status).toBe(200);
    const { items } = changeLogResponseSchema.parse(response.body);
    expect(items.map((item) => [item.action, item.changedAt, item.changedBy?.name])).toEqual([
      ['inactivated', '2026-09-24T10:02:00.000Z', 'Grace Global'],
      ['updated', '2026-09-24T10:01:00.000Z', 'Grace Global'],
      ['created', '2026-09-24T10:00:00.000Z', 'Grace Global'],
    ]);
    expect(items[0]?.changes).toEqual({
      status: { old: 'active', new: 'inactive' },
      inactiveOn: { old: null, new: '2026-09-20' },
    });
    expect(items[1]?.changes).toEqual({
      jobTitle: { old: 'Software Engineer', new: 'Senior Software Engineer' },
      flsaStatus: { old: 'exempt', new: 'non_exempt' },
    });
    expect(items[2]?.changes).toMatchObject({
      employeeCode: { old: null, new: employee.employeeCode },
      region: { old: null, new: 'Texas' },
      flsaStatus: { old: null, new: 'exempt' },
    });
  });

  it('does not record an update that changed nothing', async () => {
    const { db } = await sharedTestDatabase();
    const employee = await insertEmployee(db, { jobTitle: 'Analyst' });

    await request(await app())
      .patch(`/api/employees/${employee.id}`)
      .set('Cookie', cookie)
      .send({ jobTitle: 'Analyst' });

    expect(changeLogResponseSchema.parse((await changeLogOf(employee.id)).body).items).toEqual([]);
  });

  it('is shown to country HR users only for employees in their country', async () => {
    const { db } = await sharedTestDatabase();
    const indian = await insertEmployee(db, { countryCode: 'IN', region: 'Kerala' });
    const american = await insertEmployee(db, { countryCode: 'US', region: 'Ohio' });

    expect((await changeLogOf(indian.id, indiaCookie)).status).toBe(200);
    expect((await changeLogOf(american.id, indiaCookie)).status).toBe(404);
  });
});
