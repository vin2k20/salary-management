import { z } from 'zod';
import { countryCodeSchema } from './countries.ts';

/** Global HR users see every country; country HR users see only their own country. */
export const ROLES = ['global_hr', 'country_hr'] as const;

export type Role = (typeof ROLES)[number];

export const loginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Enter your email address')
    .pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Enter your password').max(200, 'Password is too long'),
});

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
