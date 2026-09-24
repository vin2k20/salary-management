import { z } from 'zod';
import { countryCodeSchema } from './countries.ts';

/** Global HR users see every country; country HR users see only their own country. */
export const ROLES = ['global_hr', 'country_hr'] as const;

export type Role = (typeof ROLES)[number];

/** Email typed by a user: trimmed and lower case, as stored. */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address')
  .pipe(z.email('Enter a valid email address'));

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(200, 'Password is too long'),
});

export const MIN_PASSWORD_LENGTH = 12;

/** Rules for a new password. Length matters most, so there are no character class rules. */
export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${String(MIN_PASSWORD_LENGTH)} characters`)
  .max(200, 'Use at most 200 characters');

export const forgotPasswordRequestSchema = z.object({ email: emailSchema });

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

/** Sets a password from a reset or invite link. */
export const setPasswordRequestSchema = z.object({
  token: z.string().min(1, 'The link is missing its token').max(200, 'The link is not valid'),
  password: newPasswordSchema,
});

export type SetPasswordRequest = z.infer<typeof setPasswordRequestSchema>;

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** The signed-in user, as returned by login and GET /api/auth/me. */
export const currentUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
  countryCode: countryCodeSchema.nullable(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

export const currentUserResponseSchema = z.object({ user: currentUserSchema });

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
