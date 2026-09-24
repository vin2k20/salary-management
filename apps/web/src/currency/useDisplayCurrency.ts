import { displayCurrencySchema, type DisplayCurrency } from '@salary/shared';
import { useSearchParams } from 'react-router';

const storageKey = 'displayCurrency';

function stored(): DisplayCurrency | null {
  try {
    const result = displayCurrencySchema.safeParse(localStorage.getItem(storageKey));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Whether amounts show in local currency or US dollars. The URL (?currency=USD) wins, so a
 * shared link shows what its sender saw; otherwise the browser remembers the last choice.
 */
export function useDisplayCurrency(): [DisplayCurrency, (currency: DisplayCurrency) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromUrl = displayCurrencySchema.safeParse(searchParams.get('currency'));
  const currency = fromUrl.success ? fromUrl.data : (stored() ?? 'local');

  function setCurrency(next: DisplayCurrency) {
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Storage can be unavailable (private mode); the URL still carries the choice.
    }
    setSearchParams(
      (params) => {
        params.set('currency', next);
        return params;
      },
      { replace: true },
    );
  }

  return [currency, setCurrency];
}
