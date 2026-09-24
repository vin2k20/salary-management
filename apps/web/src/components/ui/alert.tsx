import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn.ts';

/** A message that screen readers announce as soon as it appears. */
export function Alert({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border border-destructive/50 px-4 py-3 text-sm text-destructive',
        className,
      )}
      {...props}
    />
  );
}
