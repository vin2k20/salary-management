import { z } from 'zod';
import { ROLES, emailSchema } from './auth.ts';
import { CHANGE_LOG_ACTIONS } from './change-log.ts';
import { countryCodeSchema } from './countries.ts';

/** Invited users have not set a password yet; inactive users cannot sign in. */
export const USER_STATUSES = ['active', 'invited', 'inactive'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const userSummarySchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
  countryCode: countryCodeSchema.nullable(),
  status: z.enum(USER_STATUSES),
  lastLoginAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type UserSummary = z.infer<typeof userSummarySchema>;

export const userListResponseSchema = z.object({
  items: z.array(userSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export type UserListResponse = z.infer<typeof userListResponseSchema>;

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

const nameSchema = z.string().trim().min(1, 'Enter a name').max(100, 'Use at most 100 characters');

/**
 * A country HR user needs exactly one country; a global HR user has none. Shared by the add and
 * edit forms and the API.
 */
export function checkRoleAndCountry(
  value: { role?: string | undefined; countryCode?: string | null | undefined },
  context: z.RefinementCtx,
) {
  if (value.role === 'country_hr' && !value.countryCode) {
    context.addIssue({
      code: 'custom',
      path: ['countryCode'],
      message: 'Choose the country this user manages',
    });
  }
  if (value.role === 'global_hr' && value.countryCode) {
    context.addIssue({
      code: 'custom',
      path: ['countryCode'],
      message: 'Global HR users are not tied to a country',
    });
  }
}

export const createUserRequestSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    role: z.enum(ROLES, 'Choose a role'),
    countryCode: countryCodeSchema.nullable(),
  })
  .superRefine(checkRoleAndCountry);

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

/**
 * Changes to a user. Role and country are checked together against the user's current values by
 * the API, since a request may change only one of them.
 */
export const updateUserRequestSchema = z
  .object({
    name: nameSchema.optional(),
    role: z.enum(ROLES).optional(),
    countryCode: countryCodeSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  // Fields left out of the request are absent from the parsed value.
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to change',
  });

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const createUserResponseSchema = z.object({
  user: userSummarySchema,
  /** False when the user was saved but the invite email could not be sent. */
  inviteSent: z.boolean(),
});

export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;

export const changeLogEntrySchema = z.object({
  id: z.uuid(),
  action: z.enum(CHANGE_LOG_ACTIONS),
  changes: z.record(z.string(), z.object({ old: z.unknown(), new: z.unknown() })),
  changedAt: z.iso.datetime(),
  changedBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});

export type ChangeLogEntry = z.infer<typeof changeLogEntrySchema>;

export const changeLogResponseSchema = z.object({ items: z.array(changeLogEntrySchema) });

export type ChangeLogResponse = z.infer<typeof changeLogResponseSchema>;
