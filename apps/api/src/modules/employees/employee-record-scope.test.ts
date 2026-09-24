import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertEmployee, insertUser, newEmployeeRequest } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('employee records within the user scope', () => {
  let indiaCookie: string;
  let indianId: string;
  let americanId: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    indiaCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
    indianId = (await insertEmployee(db, { countryCode: 'IN', region: 'Karnataka' })).id;
    americanId = (await insertEmployee(db, { countryCode: 'US', region: 'Texas' })).id;
  });

  async function app() {
    return (await createTestApp()).app;
  }

  it('lets a country HR user read, add and change employees in their country', async () => {
    const read = await request(await app())
      .get(`/api/employees/${indianId}`)
      .set('Cookie', indiaCookie);
    const created = await request(await app())
      .post('/api/employees')
      .set('Cookie', indiaCookie)
      .send(newEmployeeRequest());
    const changed = await request(await app())
      .patch(`/api/employees/${indianId}`)
      .set('Cookie', indiaCookie)
      .send({ jobLevel: 'L3' });

    expect([read.status, created.status, changed.status]).toEqual([200, 201, 200]);
  });

  it('answers 404 for employees in other countries, as if they did not exist', async () => {
    const read = await request(await app())
      .get(`/api/employees/${americanId}`)
      .set('Cookie', indiaCookie);
    const changed = await request(await app())
      .patch(`/api/employees/${americanId}`)
      .set('Cookie', indiaCookie)
      .send({ status: 'inactive' });

    expect([read.status, changed.status]).toEqual([404, 404]);
    expect(read.body).toMatchObject({ detail: 'Employee not found' });
  });

  it('does not let a country HR user add employees in another country', async () => {
    const response = await request(await app())
      .post('/api/employees')
      .set('Cookie', indiaCookie)
      .send(newEmployeeRequest({ countryCode: 'US', region: 'Texas', countryFields: {} }));

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ detail: 'You can only add employees in India' });
  });

  it('matches job title spelling only within the country HR user country', async () => {
    const { db } = await sharedTestDatabase();
    await insertEmployee(db, {
      countryCode: 'US',
      region: 'Texas',
      jobTitle: 'Chief Scope Tester',
    });

    const response = await request(await app())
      .post('/api/employees')
      .set('Cookie', indiaCookie)
      .send(newEmployeeRequest({ jobTitle: 'chief scope tester' }));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ employee: { jobTitle: 'chief scope tester' } });
  });

  it('asks for a session', async () => {
    const response = await request(await app()).get(`/api/employees/${indianId}`);

    expect(response.status).toBe(401);
  });
});
