import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn.ts';

/**
 * A menu of actions in the shadcn/ui style, built on Radix Dropdown Menu: it opens from a
 * button, works with the keyboard and is announced as a menu, drawn above the page.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={4}
        align="end"
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-md border bg-card p-1 text-card-foreground shadow-md',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none',
        'data-[highlighted]:bg-secondary data-[highlighted]:text-secondary-foreground',
        className,
      )}
      {...props}
    />
  );
}
