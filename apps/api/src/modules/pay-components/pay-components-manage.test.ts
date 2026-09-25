import { payComponentListResponseSchema, payComponentResponseSchema } from '@salary/shared';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { changeLog } from '../../db/schema.ts';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

let sequence = 0;

/** A new component with a code no other test uses. */
function newComponent(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return {
    code: `meal_allowance_${String(sequence)}`,
    name: 'Meal allowance',
    category: 'allowance',
    countryCode: 'IN',
    defaultFrequency: 'monthly',
    ...overrides,
  };
}

describe('adding and renaming pay components', () => {
  let cookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    cookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
  });

  async function create(body: Record<string, unknown>) {
    const { app } = await createTestApp();
    return request(app).post('/api/pay-components').set('Cookie', cookie).send(body);
  }

  async function rename(id: string, name: string) {
    const { app } = await createTestApp();
    return request(app).patch(`/api/pay-components/${id}`).set('Cookie', cookie).send({ name });
  }

  async function list(country: string) {
    const { app } = await createTestApp();
    const response = await request(app)
      .get('/api/pay-components')
      .query({ country })
      .set('Cookie', cookie);
    return payComponentListResponseSchema.parse(response.body).items;
  }

  it('adds an active component that the country can then use', async () => {
    const body = newComponent();

    const response = await create(body);

    expect(response.status).toBe(201);
    const { component } = payComponentResponseSchema.parse(response.body);
    expect(component).toMatchObject({ ...body, isActive: true });
    expect((await list('IN')).map((item) => item.id)).toContain(component.id);
    expect((await list('US')).map((item) => item.id)).not.toContain(component.id);
  });

  it('adds a component for all countries', async () => {
    const response = await create(newComponent({ countryCode: null, category: 'benefit' }));

    const { component } = payComponentResponseSchema.parse(response.body);
    expect((await list('AU')).map((item) => item.id)).toContain(component.id);
  });

  it('keeps each code unique among the components a country can use', async () => {
    const first = newComponent({ code: 'site_allowance' });
    expect((await create(first)).status).toBe(201);

    const again = await create(newComponent({ code: 'site_allowance' }));
    const overAllCountries = await create(newComponent({ code: 'stipend' }));
    const overOneCountry = await create(newComponent({ code: 'basic', countryCode: null }));
    const otherCountry = await create(newComponent({ code: 'site_allowance', countryCode: 'US' }));

    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({
      detail: 'A component with the code site_allowance already exists for India',
    });
    expect(overAllCountries.body).toMatchObject({
      detail: 'A component with the code stipend already exists for all countries',
    });
    expect(overOneCountry.body).toMatchObject({
      detail: 'A component with the code basic already exists for India',
    });
    expect(otherCountry.status).toBe(201);
  });

  it('rejects invalid fields', async () => {
    const response = await create(newComponent({ code: 'Meal', category: 'perk' }));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      errors: [
        {
          field: 'code',
          message: 'Use lower-case letters, digits and underscores, starting with a letter',
        },
        { field: 'category', message: 'Choose a category' },
      ],
    });
  });

  it('renames a component, keeps its code and logs both changes', async () => {
    const created = payComponentResponseSchema.parse((await create(newComponent())).body);

    const response = await rename(created.component.id, ' Food  card ');

    expect(response.status).toBe(200);
    expect(payComponentResponseSchema.parse(response.body).component).toMatchObject({
      name: 'Food card',
      code: created.component.code,
    });
    const { db } = await sharedTestDatabase();
    const entries = await db
      .select()
      .from(changeLog)
      .where(
        and(
          eq(changeLog.entityType, 'pay_component'),
          eq(changeLog.entityId, created.component.id),
        ),
      );
    expect(entries.map((entry) => [entry.action, entry.countryCode]).sort()).toEqual([
      ['created', 'IN'],
      ['updated', 'IN'],
    ]);
    expect(entries.find((entry) => entry.action === 'updated')?.changes).toEqual({
      name: { old: 'Meal allowance', new: 'Food card' },
    });
  });

  it('answers 404 for an unknown component', async () => {
    expect((await rename('4f0c8a36-7c55-4c7f-9d52-1c8f6b8f5e21', 'X')).status).toBe(404);
  });
});
