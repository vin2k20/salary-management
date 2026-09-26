import { useState } from 'react';
import { cn } from '../lib/cn.ts';
import { THEMES, currentTheme, setTheme, type Theme } from './theme.ts';

const LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark' };

/** Switches the whole app between the light and dark themes. */
export function ThemeToggle() {
  const [theme, setChosen] = useState(currentTheme);
  return (
    <div role="group" aria-label="Colour theme" className="flex rounded-md border p-0.5 text-sm">
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          className={cn(
            'rounded px-2.5 py-1 text-muted-foreground',
            theme === option && 'bg-secondary text-secondary-foreground',
          )}
          onClick={() => {
            setTheme(option);
            setChosen(option);
          }}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
