import { z } from 'zod';

/** Health of the API and its database. The API answers 503 with "degraded" when the database is down. */
export const healthResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), database: z.literal('ok') }),
  z.object({ status: z.literal('degraded'), database: z.literal('unavailable') }),
]);

export type HealthResponse = z.infer<typeof healthResponseSchema>;
