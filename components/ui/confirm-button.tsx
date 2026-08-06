'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { cn } from '@/lib/cn';

import { Button, type ButtonProps } from './button';

/**
 * A destructive action that arms before it fires.
 *
 * Two clicks, no modal. A dialog for "delete this row" is heavier than the
 * decision deserves, but a single click on something unrecoverable is how
 * people lose data. The armed state auto-disarms, so a stray click never sits
 * there waiting to be completed by accident.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Sure?',
  className,
  size = 'sm',
  disabled,
  ...props
}: {
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
  confirmLabel?: string;
} & Omit<ButtonProps, 'onClick' | 'variant'>) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const click = () => {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    startTransition(() => {
      void onConfirm();
    });
  };

  return (
    <Button
      {...props}
      size={size}
      variant={armed ? 'danger' : 'ghost'}
      disabled={disabled || pending}
      onClick={click}
      onBlur={() => setArmed(false)}
      className={cn(armed && 'font-medium', className)}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
