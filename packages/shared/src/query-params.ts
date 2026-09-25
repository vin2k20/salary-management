import { z } from 'zod';

/** Query strings arrive as text; an empty value means "not set". */
export function optionalParam<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

/** Trimmed free text of at most 100 characters, or not set. */
export const optionalTextParam = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().max(100, 'Use at most 100 characters').optional(),
);

/** "true" (or true) turns an option on; anything else, or nothing, leaves it off. */
export const booleanParam = z
  .preprocess((value) => value === true || value === 'true', z.boolean())
  .default(false);
