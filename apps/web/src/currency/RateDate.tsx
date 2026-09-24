import { formatRateDate, useFxRates } from './rates.ts';
import { useDisplayCurrency } from './useDisplayCurrency.ts';

/** Says which rates converted amounts use; shown only when amounts are in US dollars. */
export function RateDate() {
  const [display] = useDisplayCurrency();
  const { data } = useFxRates();
  if (display !== 'USD' || !data?.rateDate) return null;
  return (
    <p className="text-sm text-muted-foreground">
      US dollars at rates of {formatRateDate(data.rateDate)}
    </p>
  );
}
