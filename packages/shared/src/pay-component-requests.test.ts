import { describe, expect, it } from 'vitest';
import {
  createPayComponentRequestSchema,
  suggestComponentCode,
  updatePayComponentRequestSchema,
} from './pay.ts';

function issues(input: unknown) {
  const result = createPayComponentRequestSchema.safeParse(input);
  return result.error?.issues.map((issue) => [issue.path.join('.'), issue.message]) ?? [];
}

describe('createPayComponentRequestSchema', () => {
  const valid = {
    code: ' meal_allowance ',
    name: '  Meal   allowance ',
    category: 'allowance',
    countryCode: 'IN',
    defaultFrequency: 'monthly',
  };

  it('accepts a component for one country or for all countries, tidied', () => {
    expect(createPayComponentRequestSchema.parse(valid)).toEqual({
      ...valid,
      code: 'meal_allowance',
      name: 'Meal allowance',
    });
    expect(createPayComponentRequestSchema.parse({ ...valid, countryCode: null })).toMatchObject({
      countryCode: null,
    });
  });

  it('reports each missing or invalid field', () => {
    expect(
      issues({ code: 'Meal Allowance', name: ' ', category: 'perk', defaultFrequency: 'daily' }),
    ).toEqual([
      ['code', 'Use lower-case letters, digits and underscores, starting with a letter'],
      ['name', 'Enter a name'],
      ['category', 'Choose a category'],
      ['countryCode', 'Choose a country, or all countries'],
      ['defaultFrequency', 'Choose how often it is usually paid'],
    ]);
  });
});

describe('updatePayComponentRequestSchema', () => {
  it('renames, deactivates or reactivates a component', () => {
    expect(updatePayComponentRequestSchema.parse({ name: ' Food  card ' })).toEqual({
      name: 'Food card',
    });
    expect(updatePayComponentRequestSchema.parse({ isActive: false })).toEqual({
      isActive: false,
    });
  });

  it('does not change the code, category, country or frequency, and needs a change', () => {
    expect(updatePayComponentRequestSchema.parse({ code: 'x', isActive: true })).toEqual({
      isActive: true,
    });
    expect(updatePayComponentRequestSchema.safeParse({}).error?.issues[0]?.message).toBe(
      'Nothing to change',
    );
  });
});

describe('suggestComponentCode', () => {
  it('turns a name into a code', () => {
    expect(suggestComponentCode(' Meal allowance (monthly) ')).toBe('meal_allowance_monthly');
    expect(suggestComponentCode('401(k) match')).toBe('k_match');
    expect(suggestComponentCode('')).toBe('');
  });
});
