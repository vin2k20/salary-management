import { payComponentResponseSchema } from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { componentId, insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('pay components within the user scope', () => {
  let indiaCookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    indiaCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
  });

  async function app() {
    return (await createTestApp()).app;
  }

  function component(code: string, countryCode: string | null) {
    return {
      code,
      name: 'Night shift allowance',
      category: 'allowance',
      countryCode,
      defaultFrequency: 'monthly',
    };
  }

  it("lets a country HR user add and change their own country's components", async () => {
    const created = await request(await app())
      .post('/api/pay-components')
      .set('Cookie', indiaCookie)
      .send(component('night_shift', 'IN'));
    const { component: added } = payComponentResponseSchema.parse(created.body);
    const changed = await request(await app())
      .patch(`/api/pay-components/${added.id}`)
      .set('Cookie', indiaCookie)
      .send({ isActive: false });

    expect([created.status, changed.status]).toEqual([201, 200]);
  });

  it('does not let a country HR user add components elsewhere', async () => {
    const otherCountry = await request(await app())
      .post('/api/pay-components')
      .set('Cookie', indiaCookie)
      .send(component('night_shift_us', 'US'));
    const allCountries = await request(await app())
      .post('/api/pay-components')
      .set('Cookie', indiaCookie)
      .send(component('night_shift_all', null));

    expect(otherCountry.status).toBe(403);
    expect(otherCountry.body).toMatchObject({ detail: 'You can only add components for India' });
    expect(allCountries.status).toBe(403);
    expect(allCountries.body).toMatchObject({
      detail: 'Only global HR users can add components for all countries',
    });
  });

  it("hides other countries' components and keeps all-country ones for global HR", async () => {
    const { db } = await sharedTestDatabase();
    const usBase = await componentId(db, 'base_salary', 'US');
    const stipend = await componentId(db, 'stipend', null);

    const other = await request(await app())
      .patch(`/api/pay-components/${usBase}`)
      .set('Cookie', indiaCookie)
      .send({ name: 'Wages' });
    const shared = await request(await app())
      .patch(`/api/pay-components/${stipend}`)
      .set('Cookie', indiaCookie)
      .send({ name: 'Intern stipend' });

    expect(other.status).toBe(404);
    expect(shared.status).toBe(403);
    expect(shared.body).toMatchObject({
      detail: 'Only global HR users can change components for all countries',
    });
  });
});
