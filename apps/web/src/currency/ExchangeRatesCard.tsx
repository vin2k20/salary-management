import { CURRENCY_CODES, STALE_RATES_AFTER_DAYS } from '@salary/shared';
import { errorMessage } from '../api/errors.ts';
import { Alert } from '../components/ui/alert.tsx';
import { formatRateDate, useFxRates } from './rates.ts';

/** The latest exchange rates to US dollars, with their date and a notice when out of date. */
export function ExchangeRatesCard() {
  const rates = useFxRates();

  return (
    <section aria-labelledby="exchange-rates-heading" className="mt-8">
      <h2 id="exchange-rates-heading" className="text-lg font-medium">
        Exchange rates
      </h2>
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
