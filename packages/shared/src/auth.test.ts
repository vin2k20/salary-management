import { describe, expect, it } from 'vitest';
import {
  currentUserSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  setPasswordRequestSchema,
} from './auth.ts';

describe('loginRequestSchema', () => {
  it('trims and lowercases the email', () => {
    expect(
      loginRequestSchema.parse({ email: '  Global.HR@Acme.Example.com ', password: 'secret' }),
    ).toEqual({ email: 'global.hr@acme.example.com', password: 'secret' });
  });

  it('explains what is missing or wrong', () => {
    const empty = loginRequestSchema.safeParse({ email: '', password: '' });
    expect(empty.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ['email', 'Enter your email address'],
      ['password', 'Enter your password'],
    ]);

    const invalid = loginRequestSchema.safeParse({ email: 'not-an-email', password: 'x' });
    expect(invalid.error?.issues.map((issue) => issue.message)).toEqual([
      'Enter a valid email address',
    ]);
  });
});

describe('currentUserSchema', () => {
  const user = {
    id: '6f1c2a4e-8b4d-4c5e-9f3a-2b7d1e0c9a11',
    email: 'hr.in@acme.example.com',
    name: 'India HR',
  };

  it('accepts a country HR user with a country and a global HR user without one', () => {
    expect(
      currentUserSchema.safeParse({ ...user, role: 'country_hr', countryCode: 'IN' }).success,
    ).toBe(true);
    expect(
      currentUserSchema.safeParse({ ...user, role: 'global_hr', countryCode: null }).success,
    ).toBe(true);
  });

  it('rejects an unknown role or country', () => {
    expect(currentUserSchema.safeParse({ ...user, role: 'admin', countryCode: null }).success).toBe(
      false,
    );
    expect(
      currentUserSchema.safeParse({ ...user, role: 'country_hr', countryCode: 'GB' }).success,
    ).toBe(false);
  });
});

describe('forgotPasswordRequestSchema', () => {
  it('normalises the email like the login form', () => {
    expect(forgotPasswordRequestSchema.parse({ email: ' HR.IN@Acme.Example.com' })).toEqual({
      email: 'hr.in@acme.example.com',
    });
    expect(forgotPasswordRequestSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('setPasswordRequestSchema', () => {
  it('accepts a token and a password of at least twelve characters', () => {
    expect(
      setPasswordRequestSchema.safeParse({ token: 'abc', password: 'twelve chars' }).success,
    ).toBe(true);
  });

  it('explains a short password or a missing token', () => {
    const result = setPasswordRequestSchema.safeParse({ token: '', password: 'short' });
    expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ['token', 'The link is missing its token'],
      ['password', 'Use at least 12 characters'],
    ]);
  });
});
