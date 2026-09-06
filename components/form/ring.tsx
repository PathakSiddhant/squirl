'use client';

import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/cn';
import type { MetricStatus } from '@/lib/form/day';

/**
 * A reading, drawn as a ring.
 *
 * ## Why this replaced the bar
 *
 * The earlier version was a labelled track — `Calories ————— 1,420 / 2,080` —
 * and it was correct and unreadable. The eye had to find the label, then cross
 * the row to the figure, then work out which of the two numbers was the target,
 * and do that four times before knowing how the day was going. That is a
 * spreadsheet with rounded corners.
 *
 * A ring answers the same question without being read: how full it is *is* the
 * answer, and the figure in the middle is there for when you want the exact
 * one. Three of them side by side is a glance, not a paragraph.
 *
 * ## The arc, and what is honest about it
 *
 * It stops at full. Going over a ceiling is shown as a second, warm arc laid
 * over the first rather than as a ring that wraps around and starts again,
 * because a ring past 100% is genuinely ambiguous — 110% and 10% draw the same
 * shape. Nothing here is ever red: over is information, not a verdict.
 */

export type RingTone = 'fuel' | 'protein' | 'water';

const STROKE: Record<RingTone, string> = {
  fuel: 'var(--app-accent)',
  protein: 'var(--form-met)',
  water: 'var(--form-water)',
};

export function Ring({
  label,
  value,
  target,
  reading,
  goal,
  tone = 'fuel',
  status,
  ceiling = false,
  unknown = false,
  size = 148,
  note,
}: {
  label: string;
  value: number | null;
  target: number | null;
  /** Already formatted; the ring does not know what a litre is. */
  reading: string;
  goal?: string;
  tone?: RingTone;
  status?: MetricStatus;
  /** A target that must not be exceeded rather than one to reach. */
  ceiling?: boolean;
  unknown?: boolean;
  size?: number;
  note?: string;
}) {
  const reduceMotion = useReducedMotion();

  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const ratio = target && target > 0 && value !== null ? value / target : 0;
  const filled = Math.min(Math.max(ratio, 0), 1);
  const over = ceiling && ratio > 1;
  // How far past the mark, as a fraction of one more lap, capped so a wild
  // overshoot does not draw a full second ring and read as "done twice".
  const spill = over ? Math.min(ratio - 1, 1) : 0;

  const met = status === 'met';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={stroke}
          />

          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={unknown ? 'var(--line-strong)' : STROKE[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={reduceMotion ? false : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - filled) }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
            }
          />

          {over ? (
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--form-partial)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={reduceMotion ? false : { strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * (1 - spill) }}
              transition={
                reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
              }
            />
          ) : null}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'form-figure leading-none',
              unknown ? 'text-[1.25rem] text-ink-3' : 'text-[clamp(1.5rem,4vw,2rem)] text-ink',
            )}
          >
            {reading}
          </span>
          {goal && !unknown ? (
            <span className="mt-1.5 text-[0.75rem] text-ink-3">of {goal}</span>
          ) : null}
        </div>

        {met ? (
          <motion.span
            initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-[var(--form-met)] text-white"
          >
            <Check size={12} weight="bold" />
          </motion.span>
        ) : null}
      </div>

      <p className="mt-3 text-[0.9375rem] font-medium text-ink">{label}</p>
      {note ? <p className="mt-0.5 text-[0.75rem] text-ink-3">{note}</p> : null}
      {over ? (
        <p className="mt-0.5 text-[0.75rem] text-[var(--form-partial)]">over the mark</p>
      ) : null}
    </div>
  );
}
