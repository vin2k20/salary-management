import { describe, expect, it, vi } from 'vitest';
import { createFrankfurterClient } from './frankfurter-client.ts';

function client(response: Response) {
  const fetch = vi.fn(() => Promise.resolve(response));
  return { frankfurter: createFrankfurterClient({ fetch }), fetch };
}

describe('Frankfurter client', () => {
  it('asks for the latest rates with the US dollar as the base', async () => {
    const { frankfurter, fetch } = client(
      Response.json({
        amount: 1,
        base: 'USD',
        date: '2026-09-24',
        rates: { AUD: 1.4232, CAD: 1.4117, INR: 95.96 },
      }),
    );

    await expect(frankfurter.latestUsdRates()).resolves.toEqual({
      date: '2026-09-24',
      rates: { AUD: '1.4232', CAD: '1.4117', INR: '95.96' },
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v1/latest?base=USD&symbols=CAD,AUD,INR',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('rejects an answer without every currency', async () => {
    const { frankfurter } = client(
      Response.json({ base: 'USD', date: '2026-09-24', rates: { CAD: 1.4117 } }),
    );

    await expect(frankfurter.latestUsdRates()).rejects.toThrow(/unexpected answer/);
  });

  it('rejects an error status', async () => {
    const { frankfurter } = client(new Response('Bad gateway', { status: 502 }));

    await expect(frankfurter.latestUsdRates()).rejects.toThrow(/status 502/);
  });
});
