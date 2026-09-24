import type { FieldError } from 'react-hook-form';
import { Label } from './ui/label.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.tsx';

export interface SelectOption {
  value: string;
  label: string;
}

/** Radix does not allow an empty item value, so "no choice" uses this stand-in. */
const NONE = '__none__';

/**
 * A labelled dropdown with its validation message. An empty value means "not chosen": it shows
 * the placeholder, or, with `emptyLabel`, an explicit choice such as "All departments".
 */
export function SelectField({
  id,
  label,
  value,
  onValueChange,
  options,
  placeholder,
  emptyLabel,
  error,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  error?: FieldError | undefined;
  disabled?: boolean;
}) {
  const errorId = `${id}-error`;
  const selected = value === '' && emptyLabel !== undefined ? NONE : value;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={selected}
        onValueChange={(next) => {
          onValueChange(next === NONE ? '' : next);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel !== undefined && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}
