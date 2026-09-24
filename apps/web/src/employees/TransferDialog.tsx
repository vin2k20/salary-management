import { zodResolver } from '@hookform/resolvers/zod';
import {
  COUNTRIES,
  COUNTRY_CODES,
  REGIONS,
  REGION_LABELS,
  transferRequestSchema,
  type CountryCode,
  type TransferRequest,
} from '@salary/shared';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { errorMessage } from '../api/errors.ts';
import { SelectField } from '../components/select-field.tsx';
import { TextField } from '../components/text-field.tsx';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';
import { Dialog } from '../components/ui/dialog.tsx';
import { PayLinesEditor, emptyLine } from './PayLinesEditor.tsx';
import { transferEmployee, usePayComponents } from './api.ts';

/** The form's values: the new country starts unchosen. */
type FormInput = Omit<z.input<typeof transferRequestSchema>, 'countryCode'> & {
  countryCode?: CountryCode | undefined;
};

// The API schema, read with the form's looser starting values.
const formSchema: z.ZodType<TransferRequest, FormInput> = transferRequestSchema;

/** Today in UTC; a move cannot be dated later. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function TransferForm({
  employeeId,
  currentCountry,
  onMoved,
  onCancel,
}: {
  employeeId: string;
  currentCountry: CountryCode;
  onMoved: (countryCode: CountryCode) => void;
  onCancel: () => void;
}) {
  const form = useForm<FormInput, unknown, TransferRequest>({
    resolver: zodResolver(formSchema),
    defaultValues: { region: '', countryFields: {}, effectiveFrom: today(), items: [] },
  });
  const countryCode = useWatch({ control: form.control, name: 'countryCode' });
  const catalogue = usePayComponents(countryCode);
  const move = useMutation({
    mutationFn: (request: TransferRequest) => transferEmployee(employeeId, request),
    onSuccess: (employee) => {
      onMoved(employee.countryCode);
    },
  });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          move.mutate(values);
        })(event);
      }}
    >
      {move.isError && <Alert>{errorMessage(move.error)}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Controller
          control={form.control}
          name="countryCode"
          render={({ field }) => (
            <SelectField
              id="transfer-country"
              label="New country"
              placeholder="Choose one"
              value={field.value ?? ''}
              onValueChange={(value) => {
                const next = COUNTRY_CODES.find((code) => code === value);
                if (!next) return;
                field.onChange(next);
                // Region and pay belong to one country, so a new country starts them again.
                form.setValue('region', '');
                form.setValue('items', [emptyLine(COUNTRIES[next].currencyCode)]);
              }}
              error={errors.countryCode}
              options={COUNTRY_CODES.filter((code) => code !== currentCountry).map((code) => ({
                value: code,
                label: COUNTRIES[code].name,
              }))}
            />
          )}
        />
        <Controller
          control={form.control}
          name="region"
          render={({ field }) => (
            <SelectField
              id="transfer-region"
              label={countryCode ? REGION_LABELS[countryCode] : 'Region'}
              placeholder={countryCode ? 'Choose one' : 'Choose a country first'}
              value={field.value}
              onValueChange={field.onChange}
              disabled={!countryCode}
              error={errors.region}
              options={(countryCode ? REGIONS[countryCode] : []).map((name) => ({
                value: name,
                label: name,
              }))}
            />
          )}
        />
        <TextField
          id="transfer-date"
          label="Effective from"
          type="date"
          max={today()}
          error={errors.effectiveFrom}
          {...form.register('effectiveFrom')}
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">New pay</legend>
        <Controller
          control={form.control}
          name="items"
          render={({ field }) => (
            <PayLinesEditor
              idPrefix="transfer-items"
              legend={(position) => `New pay component ${String(position)}`}
              lines={field.value}
              onChange={field.onChange}
              components={(catalogue.data?.items ?? []).filter((item) => item.isActive)}
              frequencies={catalogue.data?.frequencies ?? []}
              currency={countryCode ? COUNTRIES[countryCode].currencyCode : undefined}
              errorFor={(index, name) => errors.items?.[index]?.[name]?.message}
              listError={errors.items?.message ?? errors.items?.root?.message}
            />
          )}
        />
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={move.isPending}>
          {move.isPending ? 'Moving...' : 'Move employee'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Moves an employee to another country (global HR only): current pay ends on the effective
 * date and the new pay starts in the new country's currency.
 */
export function TransferDialog({
  open,
  onOpenChange,
  employeeId,
  currentCountry,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  currentCountry: CountryCode;
  onMoved: (countryCode: CountryCode) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Move to another country"
      description="Current pay ends on the effective date and the new pay starts in the new country's currency. Country-specific fields start empty and can be edited after the move."
    >
      <TransferForm
        employeeId={employeeId}
        currentCountry={currentCountry}
        onMoved={onMoved}
        onCancel={() => {
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
