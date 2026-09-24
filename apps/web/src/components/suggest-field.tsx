import { useId, useState, type Ref } from 'react';
import type { FieldError } from 'react-hook-form';
import { cn } from '../lib/cn.ts';
import { Input } from './ui/input.tsx';
import { Label } from './ui/label.tsx';

const MAX_SUGGESTIONS = 8;

/**
 * A labelled text box that suggests values already in use, in a list styled like the app's
 * dropdowns, while still accepting a new value. Arrow keys move through the list, Enter picks
 * and Escape closes it.
 */
export function SuggestField({
  id,
  label,
  value,
  onChange,
  onBlur,
  name,
  inputRef,
  suggestions,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  name: string;
  inputRef?: Ref<HTMLInputElement>;
  suggestions: readonly string[];
  error?: FieldError | undefined;
}) {
  const listId = useId();
  const errorId = `${id}-error`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const typed = value.trim().toLowerCase();
  const matches =
    typed === ''
      ? []
      : suggestions
          .filter((option) => option.toLowerCase().includes(typed) && option !== value)
          .slice(0, MAX_SUGGESTIONS);
  const shown = open && matches.length > 0;

  function pick(option: string) {
    onChange(option);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          ref={inputRef}
          name={name}
          value={value}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={listId}
          aria-activedescendant={shown && active >= 0 ? `${listId}-${String(active)}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onBlur={() => {
            setOpen(false);
            onBlur();
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              if (matches.length === 0) return;
              const step = event.key === 'ArrowDown' ? 1 : -1;
              setActive((current) => (current + step + matches.length) % matches.length);
            } else if (event.key === 'Enter' && shown && active >= 0) {
              event.preventDefault();
              const option = matches[active];
              if (option !== undefined) pick(option);
            } else if (event.key === 'Escape' && shown) {
              event.preventDefault();
              setOpen(false);
            }
          }}
        />
        {shown && (
          <ul
            id={listId}
            role="listbox"
            aria-label={`${label} suggestions`}
            className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-card p-1 text-card-foreground shadow-md"
          >
            {matches.map((option, index) => (
              <li
                key={option}
                id={`${listId}-${String(index)}`}
                role="option"
                aria-selected={index === active}
                className={cn(
                  'cursor-default rounded-sm px-2 py-1.5 text-sm select-none',
                  index === active && 'bg-secondary text-secondary-foreground',
                )}
                // Keeps focus in the text box, so picking does not close the list first.
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onMouseEnter={() => {
                  setActive(index);
                }}
                onClick={() => {
                  pick(option);
                }}
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}
