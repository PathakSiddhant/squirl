'use client';

import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/cn';
import type { MetricStatus } from '@/lib/form/day';

/**
 * The measure. Form's one signature component.
 *
 * Every fitness app reaches for the same six cards — a rounded box per metric,
 * a number in the middle, a ring around it — and the result reads as a server
 * status page for a person. §79 rules it out and this is what stands in its
 * place: a horizontal track with a mark on it, which is how a measurement has
 * been drawn since long before there were screens.
 *
 * It is one object rather than a card containing several, so a column of them
 * lines up: the tracks share a left edge and a right edge, and the eye runs
 * down the fills the way it runs down a bar chart. Six cards cannot do that,
 * which is most of why six cards never tell you anything.
 *
 * ## Scaling
 *
 * The track spans zero to whichever is larger, the target or the value. So a
 * gauge under its target puts the target at the far right and reads as
 * "distance still to go", and one that has gone past puts the target at a
 * notch part-way along and reads as "this much beyond". Nothing is ever
 * clipped, and nothing has to be squeezed into a bar that was scaled for
 * something else.
 */

export type GaugeTone = 'fuel' | 'water' | 'body' | 'neutral';

const FILL: Record<GaugeTone, string> = {
  fuel: 'bg-[var(--app-accent)]',
  water: 'bg-[var(--form-water)]',
  body: 'bg-ink-2',
  neutral: 'bg-ink-3',
};

export function Gauge({
  label,
  value,
  target,
  status,
  tone = 'fuel',
  /** Already formatted. The gauge does not know what a litre is. */
  reading,
  goal,
  note,
  action,
  ceiling = false,
}: {
  label: string;
  value: number | null;
  target: number | null;
  status?: MetricStatus;
  tone?: GaugeTone;
  reading: string;
  goal?: string;
  note?: string;
  action?: React.ReactNode;
  /** A target that must not be exceeded, rather than one to reach. */
  ceiling?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  const shown = value ?? 0;
  const known = value !== null;
  const span = Math.max(target ?? 0, shown, 1);

  const filled = known ? Math.min(shown / span, 1) : 0;
  const notch = target !== null ? target / span : null;
  const over = ceiling && target !== null && shown > target;

  // Where the base colour stops and the overflow colour begins.
  const base = over && notch !== null ? notch : filled;

  return (
    <div className="group/gauge">
      <div className="flex items-baseline justify-between gap-4">
        <span className="form-label">{label}</span>

        <span className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'form-figure text-[1.375rem]',
              known ? 'text-ink' : 'text-ink-3',
              status === 'untracked' && 'text-ink-3',
            )}
          >
            {reading}
          </span>
          {goal ? <span className="text-[0.8125rem] text-ink-3">/ {goal}</span> : null}
          {status === 'met' ? (
            <Check
              size={13}
              weight="bold"
              className="ml-0.5 text-[var(--form-met)]"
              aria-label="target met"
            />
          ) : null}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div
          className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3"
          role="meter"
          aria-valuenow={known ? shown : undefined}
          aria-valuemin={0}
          aria-valuemax={target ?? undefined}
          aria-label={label}
        >
          {/* Ticks, painted rather than built: several of these animate at once
              and forty elements per track would be forty elements too many. */}
          <div
            className="form-ticks absolute inset-0 opacity-[0.35]"
            style={{ ['--form-tick-gap' as string]: '10%' }}
            aria-hidden="true"
          />

          <motion.div
            className={cn('absolute inset-y-0 left-0 rounded-full', FILL[tone])}
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${base * 100}%` }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Past a ceiling. Warm rather than red: going over is information,
              not a verdict, and nothing in Form tells anybody off. */}
          {over ? (
            <motion.div
              className="absolute inset-y-0 rounded-r-full bg-[var(--form-partial)]"
              style={{ left: `${(notch ?? 0) * 100}%` }}
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${(filled - (notch ?? 0)) * 100}%` }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null}

          {/* The mark itself, where the target sits on the track. */}
          {notch !== null && notch < 0.999 ? (
            <span
              className="absolute inset-y-0 w-[2px] rounded-full bg-ink/25"
              style={{ left: `calc(${notch * 100}% - 1px)` }}
              aria-hidden="true"
            />
          ) : null}
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {note ? <p className="mt-1.5 text-[0.75rem] text-ink-3">{note}</p> : null}
    </div>
  );
}

/**
 * A metric with two states and no quantity: creatine taken, movement done.
 *
 * Drawn as something you press rather than as a checkbox, because it is
 * pressed every single day and a control used that often should feel like an
 * object. §21 asks for one tap and this is the whole interaction.
 */
export function Toggle({
  label,
  on,
  onToggle,
  note,
  pending,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  note?: string;
  pending?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={on}
      className={cn(
        'group/toggle flex min-w-0 flex-1 items-center gap-3 rounded-2xl border p-3.5 text-left',
        'transition-[border-color,background-color,translate] duration-[var(--t-state)]',
        'active:translate-y-px disabled:opacity-60',
        on
          ? 'border-[var(--form-met)] bg-[var(--form-met-wash)]'
          : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <motion.span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          on ? 'bg-[var(--form-met)] text-white' : 'bg-surface-3 text-ink-3',
        )}
        animate={on && !reduceMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <Check size={15} weight="bold" />
      </motion.span>

      <span className="min-w-0">
        <span className="block truncate text-[0.9375rem] font-medium text-ink">{label}</span>
        {note ? <span className="block truncate text-[0.75rem] text-ink-3">{note}</span> : null}
      </span>
    </button>
  );
}
