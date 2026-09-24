import { referenceDataSchema } from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertDirectoryData } from '../../test/directory-data.ts';
import { insertUser } from '../../test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('GET /api/reference', () => {
  let globalCookie: string;
  let indiaCookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    await insertDirectoryData(db);
    globalCookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
    indiaCookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
  });

  async function reference(cookie: string) {
    const { app } = await createTestApp();
    const response = await request(app).get('/api/reference').set('Cookie', cookie);
    expect(response.status).toBe(200);
    return referenceDataSchema.parse(response.body);
  }

  it('gives global HR users every country and the values in use', async () => {
    const data = await reference(globalCookie);

    expect(data.countries.map((country) => country.code)).toEqual(['AU', 'CA', 'IN', 'US']);
    expect(data.countries.find((country) => country.code === 'IN')).toEqual({
      code: 'IN',
      name: 'India',
      currencyCode: 'INR',
    });
    expect(data.regions).toEqual([
      { countryCode: 'CA', name: 'Ontario' },
      { countryCode: 'IN', name: 'Karnataka' },
      { countryCode: 'IN', name: 'Maharashtra' },
      { countryCode: 'US', name: 'California' },
      { countryCode: 'US', name: 'Texas' },
    ]);
    expect(data.departments).toEqual(['Engineering', 'Sales']);
    expect(data.jobTitles).toEqual(['Account Executive', 'Software Engineer']);
    expect(data.employmentTypes).toEqual(['full_time', 'part_time', 'contractor', 'intern']);
  });

  it('gives country HR users only their own country and its values', async () => {
    const data = await reference(indiaCookie);

    expect(data.countries.map((country) => country.code)).toEqual(['IN']);
    expect(data.regions.map((region) => region.name)).toEqual(['Karnataka', 'Maharashtra']);
    expect(data.departments).toEqual(['Engineering', 'Sales']);
    expect(data.jobTitles).toEqual(['Account Executive', 'Software Engineer']);
  });

  it('needs a session', async () => {
    const { app } = await createTestApp();

    expect((await request(app).get('/api/reference')).status).toBe(401);
  });
});
