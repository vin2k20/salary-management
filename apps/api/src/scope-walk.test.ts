import { EMPLOYEE_COLUMNS } from '@salary/shared';
import { eq } from 'drizzle-orm';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { employees } from './db/schema.ts';
import { sessionCookieFor } from './test/auth.ts';
import { insertExportData } from './test/export-data.ts';
import { componentId, insertUser, newEmployeeRequest } from './test/fixtures.ts';
import { createTestApp, sharedTestDatabase } from './test/test-app.ts';

/**
 * Walks every API route as a country HR user for India, reaching for data in the United States.
 * Records outside the scope answer 404, actions for global HR only answer 403, and lists and
 * statistics leave other countries out. The route count check at the end fails when a route is
 * added without a case here.
 */

interface Ids {
  usEmployee: string;
  usComponent: string;
  usUser: string;
}

type Check = (app: Express, cookie: string, ids: Ids) => Promise<void>;

const US_EMPLOYEE_ROW = `${EMPLOYEE_COLUMNS.map((column) => column.header).join(',')}\r\nUS-7,Liam,Brown,liam@example.com,Account Executive,,Sales,US,Texas,full_time,1,2026-01-05,active,,exempt,,,\r\n`;

function call(app: Express, cookie: string, method: 'get' | 'post' | 'patch', url: string) {
  return request(app)[method](url).set('Cookie', cookie);
}

const status =
  (method: 'get' | 'post' | 'patch', url: (ids: Ids) => string, expected: number, body = {}) =>
  async (app: Express, cookie: string, ids: Ids) => {
    const response = await call(app, cookie, method, url(ids)).send(body);
    expect(response.status).toBe(expected);
  };

const itemsWithout =
  (url: string, key: string, value: string) => async (app: Express, cookie: string) => {
    const response = await call(app, cookie, 'get', url);
    expect(response.status).toBe(200);
    const body = response.body as { items: Record<string, unknown>[] };
    expect(body.items.filter((item) => item[key] === value)).toEqual([]);
  };

const upload =
  (step: 'validate' | 'commit', expected: number) => async (app: Express, cookie: string) => {
    const response = await call(app, cookie, 'post', `/api/imports/${step}`)
      .set('X-Requested-With', 'fetch')
      .attach('file', Buffer.from(US_EMPLOYEE_ROW), 'employees.csv');
    expect(response.status).toBe(expected);
    if (step === 'validate') {
      expect(response.body).toMatchObject({
        valid: false,
        errors: [{ message: 'You can only import employees in India' }],
      });
    }
  };

/** Every route: public ones are listed so the count adds up, the rest are checked. */
const ROUTES: [route: string, check: Check | 'public'][] = [
  ['GET /api/health', 'public'],
  ['POST /api/auth/login', 'public'],
  ['POST /api/auth/forgot-password', 'public'],
  ['POST /api/auth/set-password', 'public'],
  ['POST /api/auth/logout', 'public'],
  ['GET /api/auth/me', 'public'],
  ['POST /api/internal/fx-rates/refresh', 'public'],

  ['GET /api/users', status('get', () => '/api/users', 403)],
  ['POST /api/users', status('post', () => '/api/users', 403, { email: 'x@example.com' })],
  [
    'PATCH /api/users/:id',
    status('patch', (ids) => `/api/users/${ids.usUser}`, 403, { name: 'X' }),
  ],
  ['POST /api/users/:id/invite', status('post', (ids) => `/api/users/${ids.usUser}/invite`, 403)],
  [
    'GET /api/users/:id/change-log',
    status('get', (ids) => `/api/users/${ids.usUser}/change-log`, 403),
  ],

  ['GET /api/fx-rates/latest', status('get', () => '/api/fx-rates/latest', 200)],
  ['POST /api/fx-rates/refresh', status('post', () => '/api/fx-rates/refresh', 403)],

  [
    'GET /api/employees',
    itemsWithout('/api/employees?country=US&includeInactive=true', 'countryCode', 'US'),
  ],
  [
    'POST /api/employees',
    status(
      'post',
      () => '/api/employees',
      403,
      newEmployeeRequest({ countryCode: 'US', region: 'Texas', countryFields: {} }),
    ),
  ],
  ['GET /api/employees/:id', status('get', (ids) => `/api/employees/${ids.usEmployee}`, 404)],
  [
    'PATCH /api/employees/:id',
    status('patch', (ids) => `/api/employees/${ids.usEmployee}`, 404, { firstName: 'X' }),
  ],
  [
    'POST /api/employees/:id/transfer',
    status('post', (ids) => `/api/employees/${ids.usEmployee}/transfer`, 403, {}),
  ],
  [
    'GET /api/employees/:id/change-log',
    status('get', (ids) => `/api/employees/${ids.usEmployee}/change-log`, 404),
  ],
  [
    'GET /api/employees/:id/pay',
    status('get', (ids) => `/api/employees/${ids.usEmployee}/pay`, 404),
  ],
  [
    'GET /api/employees/:id/pay-changes',
    status('get', (ids) => `/api/employees/${ids.usEmployee}/pay-changes`, 404),
  ],
  [
    'POST /api/employees/:id/pay-changes',
    async (app, cookie, ids) => {
      const response = await call(
        app,
        cookie,
        'post',
        `/api/employees/${ids.usEmployee}/pay-changes`,
      ).send({
        effectiveFrom: '2026-11-01',
        reason: 'revision',
        set: [
          { componentId: ids.usComponent, amount: '100.00', currency: 'USD', frequency: 'monthly' },
        ],
        end: [],
      });
      expect(response.status).toBe(404);
    },
  ],

  [
    'GET /api/reference',
    async (app, cookie) => {
      const response = await call(app, cookie, 'get', '/api/reference');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ countries: [{ code: 'IN' }] });
      expect((response.body as { countries: unknown[] }).countries).toHaveLength(1);
    },
  ],

  [
    'GET /api/pay-components',
    async (app, cookie) => {
      const response = await call(app, cookie, 'get', '/api/pay-components');
      expect(response.status).toBe(200);
      const { items } = response.body as { items: { countryCode: string | null }[] };
      expect(
        items.filter((item) => item.countryCode !== null && item.countryCode !== 'IN'),
      ).toEqual([]);
    },
  ],
  [
    'POST /api/pay-components',
    status('post', () => '/api/pay-components', 403, {
      name: 'Remote allowance',
      code: 'remote_allowance',
      category: 'allowance',
      countryCode: 'US',
      defaultFrequency: 'monthly',
    }),
  ],
  [
    'PATCH /api/pay-components/:id',
    status('patch', (ids) => `/api/pay-components/${ids.usComponent}`, 404, { name: 'X' }),
  ],

  [
    'GET /api/insights/summary',
    async (app, cookie) => {
      const response = await call(app, cookie, 'get', '/api/insights/summary?country=US');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ headcount: 0, countries: [] });
    },
  ],
  [
    'GET /api/insights/pay-range-by-country',
    itemsWithout('/api/insights/pay-range-by-country?country=US', 'countryCode', 'US'),
  ],
  [
    'GET /api/insights/by-job-title',
    status('get', () => '/api/insights/by-job-title?country=US', 200),
  ],
  [
    'GET /api/insights/cost-by-department',
    status('get', () => '/api/insights/cost-by-department?country=US', 200),
  ],
  [
    'GET /api/insights/outliers',
    itemsWithout('/api/insights/outliers?country=US', 'countryCode', 'US'),
  ],

  [
    'GET /api/exports',
    async (app, cookie) => {
      const response = await call(app, cookie, 'get', '/api/exports?format=csv&country=US');
      expect(response.status).toBe(200);
      expect(response.text).not.toContain('US-1');
    },
  ],

  ['GET /api/imports/template', status('get', () => '/api/imports/template?format=csv', 200)],
  ['POST /api/imports/validate', upload('validate', 200)],
  ['POST /api/imports/commit', upload('commit', 422)],
];

describe('every route within a country HR user scope', () => {
  let cookie: string;
  let ids: Ids;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    await insertExportData(db);
    const [usEmployee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.employeeCode, 'US-1'));
    ids = {
      usEmployee: usEmployee?.id ?? '',
      usComponent: await componentId(db, 'base_salary', 'US'),
      usUser: (await insertUser(db, { role: 'country_hr', countryCode: 'US' })).id,
    };
    cookie = await sessionCookieFor(
      await insertUser(db, { role: 'country_hr', countryCode: 'IN' }),
    );
  });

  for (const [route, check] of ROUTES) {
    if (check === 'public') continue;
    it(`${route} stays within India`, async () => {
      const { app } = await createTestApp();
      await check(app, cookie, ids);
    });
  }

  it('has a case for every route', async () => {
    const { app } = await createTestApp();
    const stack = (app as unknown as { router: { stack: { handle: unknown }[] } }).router.stack;
    let routes = 0;
    for (const layer of stack) {
      const inner = (layer.handle as { stack?: { route?: { methods: object } }[] }).stack ?? [];
      for (const item of inner) routes += Object.keys(item.route?.methods ?? {}).length;
    }

    expect(routes).toBe(ROUTES.length);
  });
});
