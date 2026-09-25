import { convertMinor, outliersResponseSchema } from '@salary/shared';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { sessionCookieFor } from '../../test/auth.ts';
import { insertUser } from '../../test/fixtures.ts';
import { TEST_RATES, insertInsightsData, insertPaidEmployee } from '../../test/insights-data.ts';
import { createTestApp, sharedTestDatabase } from '../../test/test-app.ts';

describe('GET /api/insights/outliers', () => {
  let cookie: string;

  beforeAll(async () => {
    const { db } = await sharedTestDatabase();
    await insertInsightsData(db);
    // Two Australian peer groups of six whose medians fall half way between two minor units
    // (10,000,003.5 and 10,000,004.5), and a group of four interns, too small to compare.
    const analyst = {
      countryCode: 'AU',
      region: 'New South Wales',
      department: 'Data',
      jobTitle: 'Data Analyst',
    } as const;
    const groups = [
      ['A', 'full_time', [8_500_000, 9_000_000, 10_000_003, 10_000_004, 11_000_000, 20_000_000]],
      ['B', 'part_time', [8_500_000, 9_000_000, 10_000_004, 10_000_005, 11_000_000, 20_000_000]],
    ] as const;
    for (const [group, employmentType, amounts] of groups) {
      for (const [index, amountMinor] of amounts.entries()) {
        await insertPaidEmployee(
          db,
          { ...analyst, employmentType, employeeCode: `AU-${group}${String(index + 1)}` },
          [{ component: 'base_salary', amountMinor }],
        );
      }
    }
    for (const [index, amountMinor] of [1_000_000, 1_000_000, 1_000_000, 5_000_000].entries()) {
      await insertPaidEmployee(
        db,
        {
          ...analyst,
          jobTitle: 'Data Intern',
          employmentType: 'intern',
          employeeCode: `AU-I${String(index + 1)}`,
        },
        [{ component: 'base_salary', amountMinor }],
      );
    }
    cookie = await sessionCookieFor(await insertUser(db, { role: 'global_hr' }));
  });

  async function outliers(query: Record<string, string> = {}) {
    const { app } = await createTestApp();
    const response = await request(app)
      .get('/api/insights/outliers')
      .query(query)
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    return outliersResponseSchema.parse(response.body);
  }

  const summary = (body: Awaited<ReturnType<typeof outliers>>) =>
    body.items.map((item) => [item.employeeCode, item.differencePercent]);

  it('lists pay more than 20% from the peer median, largest difference first', async () => {
    const body = await outliers();

    expect(body).toMatchObject({
      measure: 'total',
      currency: 'local',
      rateDate: null,
      page: 1,
      pageSize: 25,
      total: 5,
      limitPercent: 20,
      minimumGroupSize: 5,
    });
    // India: 200,000,000 against a median of 125,000,000. USA (a group of exactly five):
    // 15,000,000 and 9,500,000 against 12,000,000. The Indian account executives (two) and the
    // Australian interns (four) are too few to compare.
    expect(summary(body)).toEqual([
      ['AU-A6', 100],
      ['AU-B6', 100],
      ['IN-E6', 60],
      ['US-E5', 25],
      ['US-E1', -20.8],
    ]);
    expect(body.items[2]).toMatchObject({
      employeeCode: 'IN-E6',
      firstName: 'Test',
      countryCode: 'IN',
      jobTitle: 'Software Engineer',
      employmentType: 'full_time',
      annualPay: { amountMinor: 200_000_000, currency: 'INR' },
      peerMedian: { amountMinor: 125_000_000, currency: 'INR' },
      peerCount: 6,
      differencePercent: 60,
      direction: 'above',
    });
    expect(body.items[4]).toMatchObject({ direction: 'below', peerCount: 5 });
  });

  it('rounds a peer median that falls between two minor units to the even one', async () => {
    const body = await outliers({ country: 'AU' });

    expect(body.items.map((item) => [item.employeeCode, item.peerMedian.amountMinor])).toEqual([
      ['AU-A6', 10_000_004],
      ['AU-B6', 10_000_004],
    ]);
  });

  it('does not flag pay exactly 20% below the median', async () => {
    // Gross pay leaves out the employer PF, so IN-E1 earns 100,000,000: exactly 20% below.
    const body = await outliers({ country: 'IN', measure: 'gross' });

    expect(summary(body)).toEqual([['IN-E6', 60]]);
  });

  it('includes inactive employees in peer groups only when asked', async () => {
    // With the inactive engineer the Indian median is 130,000,000.
    const body = await outliers({ country: 'IN', includeInactive: 'true' });

    expect(summary(body)).toEqual([
      ['IN-X1', 592.3],
      ['IN-E6', 53.8],
    ]);
  });

  it('filters by direction and pages through the list', async () => {
    expect(summary(await outliers({ direction: 'below' }))).toEqual([['US-E1', -20.8]]);

    const second = await outliers({ pageSize: '2', page: '2' });
    expect(second).toMatchObject({ page: 2, pageSize: 2, total: 5 });
    expect(summary(second)).toEqual([
      ['IN-E6', 60],
      ['US-E5', 25],
    ]);

    const beyond = await outliers({ pageSize: '2', page: '4' });
    expect(beyond).toMatchObject({ items: [], total: 5 });
  });

  it('converts pay and the peer median to US dollars when asked', async () => {
    const body = await outliers({ country: 'IN', currency: 'USD' });

    expect(body.rateDate).toBe('2026-09-24');
    expect(body.items[0]).toMatchObject({
      annualPay: {
        amountMinor: convertMinor(200_000_000, 'INR', 'USD', TEST_RATES),
        currency: 'USD',
      },
      peerMedian: {
        amountMinor: convertMinor(125_000_000, 'INR', 'USD', TEST_RATES),
        currency: 'USD',
      },
      differencePercent: 60,
    });
  });
});
