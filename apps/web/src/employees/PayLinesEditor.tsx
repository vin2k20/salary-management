import type { CurrencyCode, PayComponent, PayFrequencyCode, PayLine } from '@salary/shared';
import { SelectField } from '../components/select-field.tsx';
import { TextField } from '../components/text-field.tsx';
import { Button } from '../components/ui/button.tsx';

type LineField = 'componentId' | 'amount' | 'frequency' | 'currency';

/** A validation message as the field components expect it. */
function asError(message: string | undefined) {
  return message === undefined ? undefined : { type: 'validate', message };
}

/** A new, empty line in a currency; the frequency follows the component once one is chosen. */
export function emptyLine(currency: CurrencyCode): PayLine {
  return { componentId: '', amount: '', currency, frequency: 'monthly' };
}

/**
 * Rows of pay components, each with an amount per period and a frequency, in one currency.
 * Controlled: the parent form owns the lines and their validation messages.
 */
export function PayLinesEditor({
  idPrefix,
  legend,
  lines,
  onChange,
  components,
  frequencies,
  currency,
  errorFor,
  listError,
}: {
  idPrefix: string;
  /** Accessible name of each row, such as "Pay component 1". */
  legend: (position: number) => string;
  lines: readonly PayLine[];
  onChange: (lines: PayLine[]) => void;
  /** Active components that can be used for this employee. */
  components: readonly PayComponent[];
  frequencies: readonly { code: PayFrequencyCode; name: string }[];
  /** The employee's currency; lines cannot be added until it is known. */
  currency: CurrencyCode | undefined;
  errorFor?: (index: number, field: LineField) => string | undefined;
  listError?: string | undefined;
}) {
  function update(index: number, change: Partial<PayLine>) {
    onChange(lines.map((line, position) => (position === index ? { ...line, ...change } : line)));
  }

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, index) => {
        const id = `${idPrefix}-${String(index)}`;
        return (
          <fieldset
            key={id}
            className="grid gap-3 rounded-md border p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-start"
          >
            <legend className="sr-only">{legend(index + 1)}</legend>
            <SelectField
              id={`${id}-component`}
              label="Component"
              placeholder="Choose one"
              value={line.componentId}
              onValueChange={(componentId) => {
                const component = components.find((item) => item.id === componentId);
                update(index, {
                  componentId,
                  ...(component ? { frequency: component.defaultFrequency } : {}),
                });
              }}
              error={asError(errorFor?.(index, 'componentId'))}
              options={components.map((component) => ({
                value: component.id,
                label: component.name,
              }))}
            />
            <div>
              <TextField
                id={`${id}-amount`}
                label="Amount"
                inputMode="decimal"
                placeholder="0.00"
                value={line.amount}
                onChange={(event) => {
                  update(index, { amount: event.target.value });
                }}
                error={asError(errorFor?.(index, 'amount') ?? errorFor?.(index, 'currency'))}
              />
              <p className="mt-1 text-xs text-muted-foreground">{line.currency} per period</p>
            </div>
            <SelectField
              id={`${id}-frequency`}
              label="Frequency"
              value={line.frequency}
              onValueChange={(frequency) => {
                const match = frequencies.find((item) => item.code === frequency);
                if (match) update(index, { frequency: match.code });
              }}
              error={asError(errorFor?.(index, 'frequency'))}
              options={frequencies.map((frequency) => ({
                value: frequency.code,
                label: frequency.name,
              }))}
            />
            <Button
              variant="ghost"
              size="sm"
              className="sm:mt-7"
              aria-label={`Remove ${legend(index + 1).toLowerCase()}`}
              onClick={() => {
                onChange(lines.filter((_line, position) => position !== index));
              }}
            >
              Remove
            </Button>
          </fieldset>
        );
      })}
      {listError && <p className="text-sm text-destructive">{listError}</p>}
      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={currency === undefined}
          onClick={() => {
            if (currency !== undefined) onChange([...lines, emptyLine(currency)]);
          }}
        >
          Add component
        </Button>
      </div>
    </div>
  );
}
