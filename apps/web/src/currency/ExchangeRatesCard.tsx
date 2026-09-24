import { CURRENCY_CODES, STALE_RATES_AFTER_DAYS } from '@salary/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../api/errors.ts';
import { useCurrentUser } from '../auth/session.ts';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';
import { formatRateDate, fxRatesQueryKey, refreshRates, useFxRates } from './rates.ts';

/**
 * The latest exchange rates to US dollars, with their date and a notice when out of date. Global
 * HR users can fetch the latest rates by hand.
 */
export function ExchangeRatesCard() {
  const rates = useFxRates();
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const refresh = useMutation({
    mutationFn: refreshRates,
    onSuccess: ({ stored: _stored, ...latest }) => {
      queryClient.setQueryData(fxRatesQueryKey, latest);
    },
  });

  let refreshNotice: string | null = null;
  if (refresh.data?.rateDate) {
    const date = formatRateDate(refresh.data.rateDate);
    refreshNotice =
      refresh.data.stored > 0
        ? `Rates updated. The latest are from ${date}.`
        : `No newer rates yet. The latest are from ${date}.`;
  }

  return (
    <section aria-labelledby="exchange-rates-heading" className="mt-8">
      <div className="flex items-center gap-4">
        <h2 id="exchange-rates-heading" className="text-lg font-medium">
          Exchange rates
        </h2>
        {user?.role === 'global_hr' && (
          <Button
            size="sm"
            variant="secondary"
            disabled={refresh.isPending}
            onClick={() => {
              refresh.mutate();
            }}
          >
            {refresh.isPending ? 'Refreshing...' : 'Refresh rates'}
          </Button>
        )}
      </div>
      {refreshNotice && (
        <p role="status" className="mt-2 text-sm">
          {refreshNotice}
        </p>
      )}
      {refresh.isError && <Alert className="mt-2">{errorMessage(refresh.error)}</Alert>}
      {rates.isPending && <p className="mt-2 text-sm text-muted-foreground">Loading rates...</p>}
      {rates.isError && <Alert className="mt-2">{errorMessage(rates.error)}</Alert>}
      {rates.data && (
        <div className="mt-2 space-y-2 text-sm">
          {rates.data.stale && (
            <Alert>
              These rates are more than {STALE_RATES_AFTER_DAYS} days old, so amounts in US dollars
              may be out of date.
            </Alert>
          )}
          <ul className="space-y-1">
            {CURRENCY_CODES.filter((code) => code !== 'USD').map((code) => {
              const rate = rates.data.rates[code];
              return rate === undefined ? null : (
                <li key={code}>
                  1 USD = {rate} {code}
                </li>
              );
            })}
          </ul>
          {rates.data.rateDate && (
            <p className="text-muted-foreground">Rates of {formatRateDate(rates.data.rateDate)}</p>
          )}
        </div>
      )}
    </section>
  );
}
