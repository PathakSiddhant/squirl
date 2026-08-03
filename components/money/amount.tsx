import { cn } from '@/lib/cn';
import { formatCompact, formatMoney, type Paise } from '@/lib/money';

import { TONE_TEXT, type MoneyTone } from './kind';

/**
 * Every rupee figure in the app goes through here.
 *
 * Direction is carried by a sign glyph as well as by colour, so the most
 * important distinction in a money app never depends on colour alone.
 */
export function Amount({
  value,
  tone = 'neutral',
  direction,
  size = 'md',
  compact = false,
  showPaise,
  className,
}: {
  value: Paise;
  tone?: MoneyTone;
  /** Overrides the sign implied by the value. */
  direction?: 'in' | 'out' | 'flat';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  compact?: boolean;
  showPaise?: boolean;
  className?: string;
}) {
  const sizes = {
    xs: 'text-[0.75rem]',
    sm: 'text-[0.8125rem]',
    md: 'text-[0.875rem]',
    lg: 'text-[1.0625rem]',
  } as const;

  const resolved = direction ?? (value > 0 ? 'in' : value < 0 ? 'out' : 'flat');
  const glyph = resolved === 'in' ? '+' : resolved === 'out' ? '−' : '';
  const text = compact
    ? formatCompact(Math.abs(value))
    : formatMoney(Math.abs(value), { paise: showPaise });

  return (
    <span className={cn('money tabular-nums', sizes[size], TONE_TEXT[tone], className)}>
      {glyph ? <span aria-hidden className="opacity-70">{glyph}</span> : null}
      {compact ? '₹' : ''}
      {text}
      <span className="sr-only">
        {resolved === 'in' ? ' received' : resolved === 'out' ? ' paid out' : ''}
      </span>
    </span>
  );
}

/** A plain figure with no direction, for balances and totals. */
export function Figure({
  value,
  size = 'md',
  className,
  compact = false,
}: {
  value: Paise;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  compact?: boolean;
}) {
  const sizes = {
    sm: 'text-[0.8125rem]',
    md: 'text-[0.9375rem]',
    lg: 'text-[1.25rem]',
    xl: 'text-[1.625rem]',
  } as const;

  return (
    <span className={cn('money tabular-nums', sizes[size], value < 0 && 'text-[var(--i-owe-text)]', className)}>
      {compact ? `₹${formatCompact(value)}` : formatMoney(value)}
    </span>
  );
}

/** A 6px dot carrying a money role, used to key list rows to the legend. */
export function ToneDot({ tone, className }: { tone: MoneyTone; className?: string }) {
  const bg = {
    in: 'bg-[var(--in)]',
    out: 'bg-[var(--out)]',
    'owed-me': 'bg-[var(--owed-me)]',
    'i-owe': 'bg-[var(--i-owe)]',
    parked: 'bg-[var(--parked)]',
    neutral: 'bg-ink-3',
  } as const;

  return <span aria-hidden className={cn('inline-block size-1.5 rounded-full', bg[tone], className)} />;
}
