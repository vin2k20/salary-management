import { convertMinor, formatMoney, type CurrencyCode } from '@salary/shared';
import { useFxRates } from './rates.ts';
import { useDisplayCurrency } from './useDisplayCurrency.ts';

/**
 * An amount in its local currency, or converted to US dollars when the toggle says so. Without a
 * rate the local amount is shown, so no figure is ever wrong.
 */
export function Money({ amountMinor, currency }: { amountMinor: number; currency: CurrencyCode }) {
  const [display] = useDisplayCurrency();
  const rates = useFxRates();

  if (display === 'USD' && currency !== 'USD') {
    if (rates.isPending) return <span className="text-muted-foreground">...</span>;
    const usdRates = rates.data?.rates ?? {};
    if (usdRates[currency] !== undefined && usdRates.USD !== undefined) {
      return <>{formatMoney(convertMinor(amountMinor, currency, 'USD', usdRates), 'USD')}</>;
    }
  }
  return <>{formatMoney(amountMinor, currency)}</>;
}
