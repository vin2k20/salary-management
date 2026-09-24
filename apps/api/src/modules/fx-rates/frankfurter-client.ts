import { z } from 'zod';

type LocalCurrency = 'CAD' | 'AUD' | 'INR';

/** Source of the latest reference rates, in units per US dollar. */
export interface RateProvider {
  latestUsdRates(): Promise<{ date: string; rates: Record<LocalCurrency, string> }>;
}

const responseSchema = z.object({
  base: z.literal('USD'),
  date: z.iso.date(),
  rates: z.object({
    CAD: z.number().positive(),
    AUD: z.number().positive(),
    INR: z.number().positive(),
  }),
});

export interface FrankfurterOptions {
  /** Passed in so tests can replace the network call. */
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * Client for the Frankfurter API (central bank reference rates, no key). Rates arrive as JSON
 * numbers with a few decimals; String() gives back the same digits, which are stored exactly.
 */
export function createFrankfurterClient({
  fetch = globalThis.fetch,
  baseUrl = 'https://api.frankfurter.dev/v1',
  timeoutMs = 10_000,
}: FrankfurterOptions = {}): RateProvider {
  return {
    async latestUsdRates() {
      const response = await fetch(`${baseUrl}/latest?base=USD&symbols=CAD,AUD,INR`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`Frankfurter answered with status ${String(response.status)}`);
      }
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error('Frankfurter gave an unexpected answer');
      }
      const { date, rates } = parsed.data;
      return {
        date,
        rates: { CAD: String(rates.CAD), AUD: String(rates.AUD), INR: String(rates.INR) },
      };
    },
  };
}
