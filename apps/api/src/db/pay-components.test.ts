import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database.ts';
import { payComponents } from './schema.ts';

describe('system pay components', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  async function codesFor(countryCode: string | null) {
    const rows = await database.db.select().from(payComponents);
    return rows
      .filter((row) => row.countryCode === countryCode)
      .map((row) => row.code)
      .sort();
  }

  it('has contract fee and stipend for all countries', async () => {
    expect(await codesFor(null)).toEqual(['contract_fee', 'stipend']);
  });

  it('has the components from the research notes for each country', async () => {
    expect(await codesFor('IN')).toEqual([
      'basic',
      'employer_esi',
      'employer_pf',
      'gratuity',
      'health_insurance',
      'hra',
      'lta',
      'performance_bonus',
      'special_allowance',
    ]);
    expect(await codesFor('US')).toEqual([
      'base_salary',
      'bonus',
      'commission',
      'employer_fica',
      'health_insurance',
      'retirement_match',
      'unemployment_insurance',
    ]);
    expect(await codesFor('CA')).toEqual([
      'base_salary',
      'bonus',
      'employer_cpp',
      'employer_ei',
      'group_benefits',
      'retirement_match',
      'vacation_pay',
    ]);
    expect(await codesFor('AU')).toEqual([
      'allowances',
      'base_salary',
      'bonus',
      'leave_loading',
      'superannuation',
    ]);
  });

  it('starts every component as active', async () => {
    const inactive = await database.db
      .select()
      .from(payComponents)
      .where(eq(payComponents.isActive, false));
    expect(inactive).toEqual([]);
  });

  it('rejects a second component with the same code for the same country', async () => {
    await expect(
      database.db.insert(payComponents).values({
        code: 'stipend',
        name: 'Duplicate stipend',
        category: 'earning',
        countryCode: null,
        defaultFrequency: 'monthly',
      }),
    ).rejects.toThrow();
  });
});
