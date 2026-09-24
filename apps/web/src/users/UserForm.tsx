import { zodResolver } from '@hookform/resolvers/zod';
import {
  COUNTRIES,
  COUNTRY_CODES,
  checkRoleAndCountry,
  countryCodeSchema,
  emailSchema,
  type CountryCode,
  type Role,
} from '@salary/shared';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { SelectField } from '../components/select-field.tsx';
import { TextField } from '../components/text-field.tsx';
import { Alert } from '../components/ui/alert.tsx';
import { Button } from '../components/ui/button.tsx';

const formSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(100, 'Use at most 100 characters'),
    email: emailSchema,
    role: z.enum(['global_hr', 'country_hr'], 'Choose a role'),
    countryCode: countryCodeSchema.nullable(),
  })
  .superRefine(checkRoleAndCountry);

type FormInput = z.input<typeof formSchema>;

export interface UserFormValues {
  name: string;
  email: string;
  role: Role;
  countryCode: CountryCode | null;
}

export const ROLE_LABELS: Record<Role, string> = {
  global_hr: 'Global HR',
  country_hr: 'Country HR',
};

/** Form to add a user, or to edit one (the email cannot be changed). */
export function UserForm({
  initial,
  submitLabel,
  pending,
  serverError,
  onSubmit,
  onCancel,
}: {
  initial?: UserFormValues;
  submitLabel: string;
  pending: boolean;
  serverError: string | null;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
}) {
  const editing = initial !== undefined;
  const form = useForm<FormInput, unknown, UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial ?? { name: '', email: '', countryCode: null },
  });
  const role = useWatch({ control: form.control, name: 'role' });

  // A global HR user has no country, so the choice is cleared and disabled.
  useEffect(() => {
    if (role === 'global_hr') form.setValue('countryCode', null);
  }, [role, form]);

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
      <TextField id="user-name" label="Name" error={errors.name} {...form.register('name')} />
      <TextField
        id="user-email"
        label="Email"
        type="email"
        readOnly={editing}
        error={errors.email}
        {...form.register('email')}
      />
      <Controller
        control={form.control}
        name="role"
        render={({ field }) => (
          <SelectField
            id="user-role"
            label="Role"
            placeholder="Choose a role"
            value={field.value}
            onValueChange={field.onChange}
            error={errors.role}
            options={[
              { value: 'global_hr', label: `${ROLE_LABELS.global_hr} (all countries)` },
              { value: 'country_hr', label: `${ROLE_LABELS.country_hr} (one country)` },
            ]}
          />
        )}
      />
      <Controller
        control={form.control}
        name="countryCode"
        render={({ field }) => (
          <SelectField
            id="user-country"
            label="Country"
            placeholder="Choose a country"
            value={field.value ?? ''}
            onValueChange={(value) => {
              field.onChange(value === '' ? null : value);
            }}
            disabled={role !== 'country_hr'}
            error={errors.countryCode}
            options={COUNTRY_CODES.map((code) => ({ value: code, label: COUNTRIES[code].name }))}
          />
        )}
      />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : submitLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
