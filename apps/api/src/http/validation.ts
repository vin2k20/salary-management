import type { z } from 'zod';
import { RequestValidationError } from './errors.ts';

/** Parses a request body with a shared schema, or throws a 400 with a message per field. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new RequestValidationError(
      result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/** Parses query parameters with a shared schema, or throws a 400 with a message per field. */
export function parseQuery<T extends z.ZodType>(schema: T, query: unknown): z.output<T> {
  return parseBody(schema, query);
}
