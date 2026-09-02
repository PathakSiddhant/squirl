import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * The small shared vocabulary the whole app is built from.
 *
 * Panels are hairline-bordered surfaces, never stacked inside each other, and
 * grouping is done with dividers rather than nested cards.
 */

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-md border border-line bg-surface', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  hint,
  action,
  className,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-4 py-3', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-[0.9375rem] font-semibold text-ink">{title}</h2>
        {hint ? <p className="mt-0.5 truncate text-[0.8125rem] text-ink-3">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Divide({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('divide-y divide-line', className)} {...props} />;
}

export function Label({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('label', className)} {...props} />;
}

// ComponentProps rather than InputHTMLAttributes so that `ref` is part of the
// type. React 19 passes it to function components as an ordinary prop, but the
// attribute-only types do not describe it.
export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-sm border border-line bg-surface px-2.5 text-[0.875rem] text-ink',
        'placeholder:text-ink-3 focus:border-line-strong',
        'transition-colors duration-[var(--t-state)]',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-sm border border-line bg-surface px-2.5 py-2 text-[0.875rem] text-ink',
        'placeholder:text-ink-3 focus:border-line-strong',
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[0.8125rem] text-[var(--i-owe-text)]">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[0.8125rem] text-ink-3">{hint}</span>
      ) : null}
    </label>
  );
}

/** A small status chip. `tone` maps to a money role, never to decoration. */
export function Chip({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: 'neutral' | 'in' | 'out' | 'owed-me' | 'i-owe' | 'parked';
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2 border-line',
    in: 'bg-[var(--in-wash)] text-[var(--in-text)] border-transparent',
    out: 'bg-[var(--out-wash)] text-[var(--out-text)] border-transparent',
    'owed-me': 'bg-[var(--owed-me-wash)] text-[var(--owed-me-text)] border-transparent',
    'i-owe': 'bg-[var(--i-owe-wash)] text-[var(--i-owe-text)] border-transparent',
    parked: 'bg-[var(--parked-wash)] text-[var(--parked-text)] border-transparent',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[0.75rem] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Empty({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-ink-3">{icon}</div> : null}
      <p className="text-[0.9375rem] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-[42ch] text-[0.875rem] text-ink-3">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Skeletons are shaped like the content they stand in for, so nothing reflows. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-surface-2', className)} />;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[1.375rem] font-semibold leading-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-[0.875rem] text-ink-2">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
