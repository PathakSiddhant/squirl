import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Primary actions are solid ink, never a colour.
 *
 * That is the design thesis showing through: colour in this app always means
 * something about money, so it can never be spent on a button.
 */
const VARIANTS = {
  primary: 'bg-ink text-ink-invert hover:opacity-90 active:opacity-80',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-3 border border-line',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  outline: 'border border-line-strong text-ink hover:bg-surface-2',
  danger: 'border border-line text-[var(--i-owe-text)] hover:bg-[var(--i-owe-wash)]',
} as const;

const SIZES = {
  sm: 'h-8 px-2.5 text-[0.8125rem] gap-1.5 rounded-sm',
  md: 'h-9 px-3 text-[0.875rem] gap-2 rounded-sm',
  lg: 'h-11 px-4 text-[0.9375rem] gap-2 rounded-md',
  icon: 'h-8 w-8 justify-center rounded-sm',
  'icon-lg': 'h-9 w-9 justify-center rounded-sm',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', asChild = false, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap font-medium',
        'transition-[background-color,opacity,border-color] duration-[var(--t-state)] ease-[var(--ease)]',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
