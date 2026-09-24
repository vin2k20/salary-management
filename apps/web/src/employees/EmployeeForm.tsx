import { zodResolver } from '@hookform/resolvers/zod';
import {
  COUNTRIES,
  COUNTRY_CODES,
  EMPLOYMENT_TYPES,
  FLSA_STATUSES,
  REGIONS,
  REGION_LABELS,
  createEmployeeRequestSchema,
  type CountryCode,
  type CreateEmployeeRequest,
  type EmploymentType,
} from '@salary/shared';
import type { ComponentProps } from 'react';
import {
  Controller,
  useForm,
  useWatch,
  type DefaultValues,
  type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';
import { SelectField } from '../components/select-field.tsx';
import { SuggestField } from '../components/suggest-field.tsx';
import { TextField } from '../components/text-field.tsx';
import { Alert } from '../components/ui/alert.tsx';
import { Button, ButtonLink } from '../components/ui/button.tsx';
import { PayLinesEditor } from './PayLinesEditor.tsx';
import { usePayComponents, useReferenceData } from './api.ts';
import { EMPLOYMENT_TYPE_LABELS, FLSA_STATUS_LABELS } from './labels.ts';

/** The form's values: the country and employment type start unchosen. */
export type EmployeeFormInput = Omit<
  z.input<typeof createEmployeeRequestSchema>,
  'countryCode' | 'employmentType'
> & {
  countryCode?: CountryCode | undefined;
  employmentType?: EmploymentType | undefined;
};

// The API schema, read with the form's looser starting values.
const formSchema: z.ZodType<CreateEmployeeRequest, EmployeeFormInput> = createEmployeeRequestSchema;

type Form = UseFormReturn<EmployeeFormInput, unknown, CreateEmployeeRequest>;

const emptyEmployee: DefaultValues<EmployeeFormInput> = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  email: '',
  jobTitle: '',
  jobLevel: '',
  department: '',
  region: '',
  fte: 1,
  hireDate: '',
  countryFields: {},
};

function Checkbox({
  id,
  label,
  ...props
}: { id: string; label: string } & ComponentProps<'input'>) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <input id={id} type="checkbox" className="h-4 w-4 accent-primary" {...props} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

/** The optional fields that only apply in the chosen country. */
function CountryFields({ form, countryCode }: { form: Form; countryCode: CountryCode }) {
  const errors = form.formState.errors.countryFields;
  switch (countryCode) {
    case 'US':
      return (
        <Controller
          control={form.control}
          name="countryFields.flsaStatus"
          render={({ field }) => (
            <SelectField
              id="employee-flsa-status"
              label="FLSA status"
              value={field.value ?? ''}
              onValueChange={field.onChange}
              emptyLabel="Not set"
              error={errors?.flsaStatus}
              options={FLSA_STATUSES.map((status) => ({
                value: status,
                label: FLSA_STATUS_LABELS[status],
              }))}
            />
          )}
        />
      );
    case 'AU':
      return (
        <TextField
          id="employee-award"
          label="Award or agreement"
          error={errors?.award}
          {...form.register('countryFields.award')}
        />
      );
    case 'IN':
      return (
        <div className="flex flex-col justify-center gap-3">
          <Checkbox
            id="employee-pf"
            label="PF applies"
            {...form.register('countryFields.pfApplicable')}
          />
          <Checkbox
            id="employee-esi"
            label="ESI applies"
            {...form.register('countryFields.esiApplicable')}
          />
        </div>
      );
    case 'CA':
      return null;
  }
}

/**
 * Form to add an employee, or to edit one. The employee code and country cannot be changed
 * here: imports match on the code, and a move to another country has its own rules. Job titles
 * and departments suggest the values already in use, so the same role is written the same way.
 */
export function EmployeeForm({
  initial,
  fixedCountry,
  submitLabel,
  pending,
  serverError,
  cancelTo,
  onSubmit,
}: {
  initial?: EmployeeFormInput;
  /** The only country a country HR user can add employees in. */
  fixedCountry?: CountryCode | null;
  submitLabel: string;
  pending: boolean;
  serverError: string | null;
  cancelTo: string;
  onSubmit: (values: CreateEmployeeRequest) => void;
}) {
  const editing = initial !== undefined;
  const form: Form = useForm<EmployeeFormInput, unknown, CreateEmployeeRequest>({
    resolver: zodResolver(formSchema),
    defaultValues: initial ?? { ...emptyEmployee, countryCode: fixedCountry ?? undefined },
  });
  const countryCode = useWatch({ control: form.control, name: 'countryCode' });
  // Job titles and departments already in use in the user's scope, offered as suggestions.
  const reference = useReferenceData();
  // Components for starting pay, once the country is known.
  const catalogue = usePayComponents(editing ? undefined : countryCode);
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
        id="employee-code"
        label="Employee code"
        readOnly={editing}
        error={errors.employeeCode}
        {...form.register('employeeCode')}
      />
      <Controller
        control={form.control}
        name="countryCode"
        render={({ field }) => (
          <SelectField
            id="employee-country"
            label="Country"
            placeholder="Choose one"
            value={field.value ?? ''}
            onValueChange={(value) => {
              field.onChange(value);
              // Regions and country fields belong to one country, so a new country clears them.
              form.setValue('region', '');
              form.setValue('countryFields', {});
              form.setValue('startingPay', []);
            }}
            disabled={editing || Boolean(fixedCountry)}
            error={errors.countryCode}
            options={COUNTRY_CODES.map((code) => ({ value: code, label: COUNTRIES[code].name }))}
          />
        )}
      />
      <TextField
        id="employee-first-name"
        label="First name"
        autoComplete="off"
        error={errors.firstName}
        {...form.register('firstName')}
      />
      <TextField
        id="employee-last-name"
        label="Last name"
        autoComplete="off"
        error={errors.lastName}
        {...form.register('lastName')}
      />
      <TextField
        id="employee-email"
        label="Work email"
        type="email"
        autoComplete="off"
        error={errors.email}
        {...form.register('email')}
      />
      <Controller
        control={form.control}
        name="jobTitle"
        render={({ field }) => (
          <SuggestField
            id="employee-job-title"
            label="Job title"
            name={field.name}
            inputRef={field.ref}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            suggestions={reference.data?.jobTitles ?? []}
            error={errors.jobTitle}
          />
        )}
      />
      <TextField
        id="employee-job-level"
        label="Job level (optional)"
        placeholder="For example L3"
        error={errors.jobLevel}
        {...form.register('jobLevel')}
      />
      <Controller
        control={form.control}
        name="department"
        render={({ field }) => (
          <SuggestField
            id="employee-department"
            label="Department"
            name={field.name}
            inputRef={field.ref}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            suggestions={reference.data?.departments ?? []}
            error={errors.department}
          />
        )}
      />
      <Controller
        control={form.control}
        name="region"
        render={({ field }) => (
          <SelectField
            id="employee-region"
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
      <Controller
        control={form.control}
        name="employmentType"
        render={({ field }) => (
          <SelectField
            id="employee-employment-type"
            label="Employment type"
            placeholder="Choose one"
            value={field.value ?? ''}
            onValueChange={field.onChange}
            error={errors.employmentType}
            options={EMPLOYMENT_TYPES.map((type) => ({
              value: type,
              label: EMPLOYMENT_TYPE_LABELS[type],
            }))}
          />
        )}
      />
      <TextField
        id="employee-fte"
        label="FTE"
        type="number"
        step="0.001"
        min="0"
        max="1"
        error={errors.fte}
        {...form.register('fte', { valueAsNumber: true })}
      />
      <TextField
        id="employee-hire-date"
        label="Hire date"
        type="date"
        error={errors.hireDate}
        {...form.register('hireDate')}
      />
      {countryCode && <CountryFields form={form} countryCode={countryCode} />}
      {!editing && (
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm font-medium">Starting pay (optional)</legend>
          <p className="mb-3 text-sm text-muted-foreground">
            Starts on the hire date. Pay can also be recorded later from the employee page.
          </p>
          <Controller
            control={form.control}
            name="startingPay"
            render={({ field }) => (
              <PayLinesEditor
                idPrefix="starting-pay"
                legend={(position) => `Pay component ${String(position)}`}
                lines={field.value ?? []}
                onChange={field.onChange}
                components={(catalogue.data?.items ?? []).filter((item) => item.isActive)}
                frequencies={catalogue.data?.frequencies ?? []}
                currency={countryCode ? COUNTRIES[countryCode].currencyCode : undefined}
                errorFor={(index, name) => errors.startingPay?.[index]?.[name]?.message}
              />
            )}
          />
        </fieldset>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : submitLabel}
        </Button>
        <ButtonLink to={cancelTo} variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
