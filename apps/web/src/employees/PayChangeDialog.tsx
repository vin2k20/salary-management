import { zodResolver } from '@hookform/resolvers/zod';
import {
  CURRENCY_CODES,
  MANUAL_PAY_CHANGE_REASONS,
  PAY_FREQUENCY_CODES,
  fromMinorUnits,
  payLineSchema,
  positiveMinorUnits,
  type CountryCode,
  type CurrencyCode,
  type CurrentPayItem,
  type PayChangeRequestBody,
  type PayFrequencyCode,
} from '@salary/shared';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '../api/errors.ts';
import { SelectField } from '../components/select-field.tsx';
import { TextField } from '../components/text-field.tsx';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';
import { Dialog } from '../components/ui/dialog.tsx';
import { PayLinesEditor } from './PayLinesEditor.tsx';
import { recordPayChange, useCurrentPay, usePayComponents } from './api.ts';
import { PAY_CHANGE_REASON_LABELS, frequencyLabel } from './labels.ts';

const ACTIONS = ['keep', 'change', 'end'] as const;

const ACTION_LABELS: Record<(typeof ACTIONS)[number], string> = {
  keep: 'Keep',
  change: 'Change',
  end: 'End',
};

const AMOUNT_MESSAGE = 'Enter an amount above zero, such as 1250.50';

const UNCHANGED_MESSAGE = 'Enter a different amount or frequency, or choose Keep';

/** The dialog's own shape: one row per current component, and new components to add. */
const formSchema = z.object({
  effectiveFrom: z.iso.date('Enter a valid date'),
  reason: z.enum(MANUAL_PAY_CHANGE_REASONS, 'Choose a reason'),
  note: z.string().trim().max(500, 'Use at most 500 characters'),
  current: z.array(
    z
      .object({
        componentId: z.string(),
        name: z.string(),
        /** The current amount and frequency in words, shown under the choice. */
        now: z.string(),
        currentAmountMinor: z.number(),
        currentFrequency: z.enum(PAY_FREQUENCY_CODES as [PayFrequencyCode, ...PayFrequencyCode[]]),
        action: z.enum(ACTIONS),
        amount: z.string().trim(),
        currency: z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]]),
        frequency: z.enum(PAY_FREQUENCY_CODES as [PayFrequencyCode, ...PayFrequencyCode[]]),
      })
      .superRefine((row, context) => {
        if (row.action !== 'change') return;
        const amountMinor = positiveMinorUnits(row.amount, row.currency);
        if (amountMinor === null) {
          context.addIssue({ code: 'custom', path: ['amount'], message: AMOUNT_MESSAGE });
        } else if (
          amountMinor === row.currentAmountMinor &&
          row.frequency === row.currentFrequency
        ) {
          // The API refuses a change that keeps both, so it is caught here first.
          context.addIssue({ code: 'custom', path: ['amount'], message: UNCHANGED_MESSAGE });
        }
      }),
  ),
  added: z.array(payLineSchema),
});

type FormValues = z.output<typeof formSchema>;

/** The form's values: the reason starts unchosen. */
type FormInput = Omit<z.input<typeof formSchema>, 'reason'> & {
  reason?: FormValues['reason'] | undefined;
};

// The dialog schema, read with the form's looser starting values.
const resolverSchema: z.ZodType<FormValues, FormInput> = formSchema;

/** Today in UTC, the day the API checks dates against. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function startingValues(items: readonly CurrentPayItem[]): FormInput {
  return {
    effectiveFrom: today(),
    note: '',
    current: items.map((item) => ({
      componentId: item.component.id,
      name: item.component.name,
      now: `${fromMinorUnits(item.amount.amountMinor, item.amount.currency)} ${item.amount.currency} ${frequencyLabel(item.frequency, true)}`,
      currentAmountMinor: item.amount.amountMinor,
      currentFrequency: item.frequency,
      action: 'keep',
      amount: fromMinorUnits(item.amount.amountMinor, item.amount.currency),
      currency: item.amount.currency,
      frequency: item.frequency,
    })),
    added: [],
  };
}

/** The request the API expects, or null when the form changes nothing. */
function toRequest(values: FormValues): PayChangeRequestBody | null {
  const changed = values.current.filter((row) => row.action === 'change');
  const set = [
    ...changed.map((row) => ({
      componentId: row.componentId,
      amount: row.amount,
      currency: row.currency,
      frequency: row.frequency,
    })),
    ...values.added,
  ];
  const end = values.current.filter((row) => row.action === 'end').map((row) => row.componentId);
  if (set.length === 0 && end.length === 0) return null;
  return {
    effectiveFrom: values.effectiveFrom,
    reason: values.reason,
    ...(values.note === '' ? {} : { note: values.note }),
    set,
    end,
  };
}

type CurrentRow = FormInput['current'][number];

/** One row per current component: keep it, change its amount or frequency, or end it. */
function CurrentRows({
  rows,
  onChange,
  frequencies,
  amountError,
}: {
  rows: readonly CurrentRow[];
  onChange: (rows: CurrentRow[]) => void;
  frequencies: readonly { code: PayFrequencyCode; name: string }[];
  amountError: (index: number) => string | undefined;
}) {
  function update(index: number, change: Partial<CurrentRow>) {
    onChange(rows.map((row, position) => (position === index ? { ...row, ...change } : row)));
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-medium">Current components</legend>
      {rows.map((row, index) => {
        const id = `pay-change-current-${String(index)}`;
        const message = amountError(index);
        return (
          <div key={row.componentId} className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
            <div>
              <SelectField
                id={`${id}-action`}
                label={row.name}
                value={row.action}
                onValueChange={(action) => {
                  const match = ACTIONS.find((item) => item === action);
                  if (match) update(index, { action: match });
                }}
                options={ACTIONS.map((action) => ({ value: action, label: ACTION_LABELS[action] }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">Now {row.now}</p>
            </div>
            {row.action === 'change' && (
              <>
                <TextField
                  id={`${id}-amount`}
                  label={`New amount for ${row.name}`}
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(event) => {
                    update(index, { amount: event.target.value });
                  }}
                  error={message === undefined ? undefined : { type: 'validate', message }}
                />
                <SelectField
                  id={`${id}-frequency`}
                  label={`Frequency for ${row.name}`}
                  value={row.frequency}
                  onValueChange={(frequency) => {
                    const match = frequencies.find((item) => item.code === frequency);
                    if (match) update(index, { frequency: match.code });
                  }}
                  options={frequencies.map((frequency) => ({
                    value: frequency.code,
                    label: frequency.name,
                  }))}
                />
              </>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

function PayChangeForm({
  employeeId,
  countryCode,
  currency,
  items,
  onSaved,
  onCancel,
}: {
  employeeId: string;
  countryCode: CountryCode;
  currency: CurrencyCode;
  items: readonly CurrentPayItem[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const catalogue = usePayComponents(countryCode);
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(resolverSchema),
    defaultValues: startingValues(items),
  });
  const save = useMutation({
    mutationFn: (request: PayChangeRequestBody) => recordPayChange(employeeId, request),
    onSuccess: onSaved,
  });
  const { errors } = form.formState;
  const frequencies = catalogue.data?.frequencies ?? [];
  const inPay = new Set(items.map((item) => item.component.id));
  const addable = (catalogue.data?.items ?? []).filter(
    (component) => component.isActive && !inPay.has(component.id),
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          const request = toRequest(values);
          if (request === null) {
            form.setError('root', { message: 'Change, add or end at least one component' });
            return;
          }
          save.mutate(request);
        })(event);
      }}
    >
      {save.isError && <Alert>{errorMessage(save.error)}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="pay-change-date"
          label="Effective from"
          type="date"
          error={errors.effectiveFrom}
          {...form.register('effectiveFrom')}
        />
        <Controller
          control={form.control}
          name="reason"
          render={({ field }) => (
            <SelectField
              id="pay-change-reason"
              label="Reason"
              placeholder="Choose one"
              value={field.value ?? ''}
              onValueChange={field.onChange}
              error={errors.reason}
              options={MANUAL_PAY_CHANGE_REASONS.map((reason) => ({
                value: reason,
                label: PAY_CHANGE_REASON_LABELS[reason],
              }))}
            />
          )}
        />
      </div>

      {items.length > 0 && (
        <Controller
          control={form.control}
          name="current"
          render={({ field }) => (
            <CurrentRows
              rows={field.value}
              onChange={field.onChange}
              frequencies={frequencies}
              amountError={(index) => errors.current?.[index]?.amount?.message}
            />
          )}
        />
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Add components</legend>
        <Controller
          control={form.control}
          name="added"
          render={({ field }) => (
            <PayLinesEditor
              idPrefix="pay-change-added"
              legend={(position) => `New component ${String(position)}`}
              lines={field.value}
              onChange={field.onChange}
              components={addable}
              frequencies={frequencies}
              currency={currency}
              errorFor={(index, name) => errors.added?.[index]?.[name]?.message}
            />
          )}
        />
      </fieldset>

      <TextField
        id="pay-change-note"
        label="Note (optional)"
        error={errors.note}
        {...form.register('note')}
      />

      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving...' : 'Save pay change'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Records a pay change: from the effective date, current components can be changed or ended and
 * new ones added, all in the employee's currency. The API applies the pay change rules again.
 */
export function PayChangeDialog({
  open,
  onOpenChange,
  employeeId,
  countryCode,
  currency,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  countryCode: CountryCode;
  currency: CurrencyCode;
  onSaved: () => void;
}) {
  const pay = useCurrentPay(employeeId);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record pay change"
      description={`Amounts are per period in ${currency}. A change dated after today is kept as scheduled until its date.`}
    >
      {pay.data ? (
        <PayChangeForm
          employeeId={employeeId}
          countryCode={countryCode}
          currency={currency}
          items={pay.data.items}
          onSaved={onSaved}
          onCancel={() => {
            onOpenChange(false);
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Loading pay...</p>
      )}
    </Dialog>
  );
}
