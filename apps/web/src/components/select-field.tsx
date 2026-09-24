import type { ComponentProps } from 'react';
import type { FieldError } from 'react-hook-form';
import { Label } from './ui/label.tsx';
import { Select } from './ui/select.tsx';

/** A labelled select with its validation message, linked for screen readers. */
export function SelectField({
  id,
  label,
  error,
  children,
  ...selectProps
}: { id: string; label: string; error?: FieldError | undefined } & ComponentProps<'select'>) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...selectProps}
      >
        {children}
      </Select>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}
