import { describe, expect, it } from 'vitest';
import { createUserRequestSchema, updateUserRequestSchema } from './users.ts';

describe('createUserRequestSchema', () => {
  const base = { name: ' Priya Nair ', email: ' Priya.Nair@Acme.Example.com' };

  it('accepts a country HR user with a country and normalises name and email', () => {
    expect(
      createUserRequestSchema.parse({ ...base, role: 'country_hr', countryCode: 'IN' }),
    ).toEqual({
      name: 'Priya Nair',
      email: 'priya.nair@acme.example.com',
      role: 'country_hr',
      countryCode: 'IN',
    });
  });

  it('accepts a global HR user without a country', () => {
    expect(
      createUserRequestSchema.safeParse({ ...base, role: 'global_hr', countryCode: null }).success,
    ).toBe(true);
  });

  it('requires a country for a country HR user and none for a global HR user', () => {
    const missing = createUserRequestSchema.safeParse({
      ...base,
      role: 'country_hr',
      countryCode: null,
    });
    const extra = createUserRequestSchema.safeParse({
      ...base,
      role: 'global_hr',
      countryCode: 'US',
    });

    expect(missing.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ['countryCode', 'Choose the country this user manages'],
    ]);
    expect(extra.error?.issues.map((issue) => issue.message)).toEqual([
      'Global HR users are not tied to a country',
    ]);
  });

  it('explains missing name, invalid email and missing role', () => {
    const result = createUserRequestSchema.safeParse({
      name: ' ',
      email: 'nope',
      role: '',
      countryCode: null,
    });
    expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ['name', 'Enter a name'],
      ['email', 'Enter a valid email address'],
      ['role', 'Choose a role'],
    ]);
  });
});

describe('updateUserRequestSchema', () => {
  it('accepts any one change', () => {
    expect(updateUserRequestSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateUserRequestSchema.safeParse({ countryCode: 'AU' }).success).toBe(true);
  });

  it('rejects an empty change', () => {
    expect(updateUserRequestSchema.safeParse({}).error?.issues[0]?.message).toBe(
      'Nothing to change',
    );
  });
});
