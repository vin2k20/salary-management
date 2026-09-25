import { zodResolver } from '@hookform/resolvers/zod';
import {
  COUNTRIES,
  COUNTRY_CODES,
  PAY_COMPONENT_CATEGORIES,
  createPayComponentRequestSchema,
  suggestComponentCode,
  type CountryCode,
  type CreatePayComponentRequest,
  type PayComponentCategory,
  type PayFrequencyCode,
} from '@salary/shared';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { SelectField } from '../components/select-field.tsx';
import { TextField } from '../components/text-field.tsx';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';
import { CATEGORY_LABELS } from './labels.ts';

/** The form's values: category, country and frequency start unchosen. */
type FormInput = Omit<
  z.input<typeof createPayComponentRequestSchema>,
  'category' | 'countryCode' | 'defaultFrequency'
> & {
  category?: PayComponentCategory | undefined;
  countryCode?: CountryCode | null | undefined;
  defaultFrequency?: PayFrequencyCode | undefined;
};

// The API schema, read with the form's looser starting values.
const formSchema: z.ZodType<CreatePayComponentRequest, FormInput> = createPayComponentRequestSchema;

/** "All countries" in the country list; the request sends null for it. */
const ALL_COUNTRIES = 'all';

/**
 * Form to add a pay component. The code is suggested from the name until the user types one.
 * Country HR users add components for their own country only.
 */
export function PayComponentForm({
  fixedCountry,
  frequencies,
  pending,
  serverError,
  onSubmit,
  onCancel,
}: {
  fixedCountry: CountryCode | null;
  frequencies: readonly { code: PayFrequencyCode; name: string }[];
  pending: boolean;
  serverError: string | null;
  onSubmit: (values: CreatePayComponentRequest) => void;
  onCancel: () => void;
}) {
  const form = useForm<FormInput, unknown, CreatePayComponentRequest>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: '', name: '', ...(fixedCountry ? { countryCode: fixedCountry } : {}) },
  });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event);
      }}
    >
      {serverError && <Alert className="sm:col-span-2">{serverError}</Alert>}
      <TextField
        id="component-name"
        label="Name"
        error={errors.name}
        {...form.register('name', {
          onChange: (event: { target: { value: string } }) => {
            if (!form.getFieldState('code').isDirty) {
              form.setValue('code', suggestComponentCode(event.target.value));
            }
          },
        })}
      />
      <div>
        <TextField
          id="component-code"
          label="Code"
          error={errors.code}
          {...form.register('code')}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Used in import files; it cannot be changed later.
        </p>
      </div>
      <Controller
        control={form.control}
        name="category"
        render={({ field }) => (
          <SelectField
            id="component-category"
            label="Category"
            placeholder="Choose one"
            value={field.value ?? ''}
            onValueChange={field.onChange}
            error={errors.category}
            options={PAY_COMPONENT_CATEGORIES.map((category) => ({
              value: category,
              label: CATEGORY_LABELS[category],
            }))}
          />
        )}
      />
      <Controller
        control={form.control}
        name="countryCode"
        render={({ field }) => (
          <SelectField
            id="component-country"
            label="Country"
            placeholder="Choose one"
            value={field.value === null ? ALL_COUNTRIES : (field.value ?? '')}
            onValueChange={(value) => {
              field.onChange(
                value === ALL_COUNTRIES ? null : COUNTRY_CODES.find((code) => code === value),
              );
            }}
            disabled={fixedCountry !== null}
            error={errors.countryCode}
            options={[
              { value: ALL_COUNTRIES, label: 'All countries' },
              ...COUNTRY_CODES.map((code) => ({ value: code, label: COUNTRIES[code].name })),
            ]}
          />
        )}
      />
      <Controller
        control={form.control}
        name="defaultFrequency"
        render={({ field }) => (
          <SelectField
            id="component-frequency"
            label="Usual frequency"
            placeholder="Choose one"
            value={field.value ?? ''}
            onValueChange={field.onChange}
            error={errors.defaultFrequency}
            options={frequencies.map((frequency) => ({
              value: frequency.code,
              label: frequency.name,
            }))}
          />
        )}
      />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : 'Add'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
