import type { ComponentProps } from 'react';
import type { FieldError } from 'react-hook-form';
import { Input } from './ui/input.tsx';
import { Label } from './ui/label.tsx';

/** A labelled input with its validation message, linked for screen readers. */
export function TextField({
  id,
  label,
  error,
  ...inputProps
}: { id: string; label: string; error?: FieldError | undefined } & ComponentProps<'input'>) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}
