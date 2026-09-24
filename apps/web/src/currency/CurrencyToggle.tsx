import type { DisplayCurrency } from '@salary/shared';
import { cn } from '../lib/cn.ts';
import { useDisplayCurrency } from './useDisplayCurrency.ts';

const OPTIONS: { value: DisplayCurrency; label: string }[] = [
  { value: 'local', label: 'Local currency' },
  { value: 'USD', label: 'USD' },
];

/** Switches every amount on screen between local currency and US dollars. */
export function CurrencyToggle() {
  const [currency, setCurrency] = useDisplayCurrency();
  return (
    <div role="group" aria-label="Show amounts in" className="flex rounded-md border p-0.5 text-sm">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={currency === option.value}
          className={cn(
            'rounded px-2.5 py-1 text-muted-foreground',
            currency === option.value && 'bg-secondary text-foreground',
          )}
          onClick={() => {
            setCurrency(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
