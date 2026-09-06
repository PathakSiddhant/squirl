'use client';

import { Flag } from '@phosphor-icons/react/dist/csr/Flag';
import { motion, useReducedMotion } from 'motion/react';

import { elapsedFraction, weightProgress } from '@/lib/form/calc';
import type { PhaseView } from '@/lib/form/phases';
import { weightFigure, type WeightUnit } from '@/lib/form/units';

/**
 * The phase you are inside, drawn rather than written.
 *
 * ## What replaced what
 *
 * This used to be a strip of text wedged under the navigation — `Cut · day 1
 * of 183 · 72.5 → 68.0 kg`. Everything in it was true and none of it was
 * legible at a glance: three separate facts separated by punctuation, which is
 * a sentence pretending to be an interface.
 *
 * ## Two quantities, one dial
 *
 * The dial carries the only comparison that matters in a phase, and it is the
 * reason this is a picture rather than a paragraph:
 *
 *   the outer arc    how much of the *time* has gone
 *   the inner arc    how far the *body* has actually come
 *
 * A phase two-thirds through the calendar and one-third through the weight is
 * worth thinking about, and seeing one arc lead the other says that instantly.
 * Nothing here is ever a score — no red, no "behind schedule", no exhortation.
 * The arcs sit where they sit.
 *
 * ## The journey
 *
 * Beside the dial, the weight is three stones on a path: where this started,
 * where the body is now, where it is aimed. Each is a figure with its name
 * underneath rather than beside it, so the eye reads the numbers first and
 * only goes looking for the captions if it needs them.
 */
export function PhaseCapsule({
  phase,
  currentWeightG,
  unit,
  today,
}: {
  phase: PhaseView;
  currentWeightG: number | null;
  unit: WeightUnit;
  today: string;
}) {
  const reduceMotion = useReducedMotion();

  const elapsed = elapsedFraction(phase.startDay, phase.targetDay, today);
  const covered =
    currentWeightG !== null && phase.startWeightG !== null && phase.targetWeightG !== null
      ? weightProgress(phase.startWeightG, currentWeightG, phase.targetWeightG)
      : null;

  const size = 132;
  const outerR = 58;
  const innerR = 44;
  const stroke = 9;
  const outerC = 2 * Math.PI * outerR;
  const innerC = 2 * Math.PI * innerR;

  const clamp = (n: number) => Math.min(Math.max(n, 0), 1);
  const spring = reduceMotion
    ? { duration: 0 }
    : { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const };

  const weeks = Math.max(1, Math.round(phase.totalDays / 7));

  return (
    <section className="form-panel overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-6">
        {/* ------------------------------------------------------- the dial */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={outerR}
              fill="none"
              stroke="var(--surface-3)"
              strokeWidth={stroke}
            />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={outerR}
              fill="none"
              stroke="var(--line-strong)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={outerC}
              initial={reduceMotion ? false : { strokeDashoffset: outerC }}
              animate={{ strokeDashoffset: outerC * (1 - clamp(elapsed)) }}
              transition={spring}
            />

            <circle
              cx={size / 2}
              cy={size / 2}
              r={innerR}
              fill="none"
              stroke="var(--surface-3)"
              strokeWidth={stroke}
            />
            {covered !== null ? (
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={innerR}
                fill="none"
                stroke="var(--app-accent)"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={innerC}
                initial={reduceMotion ? false : { strokeDashoffset: innerC }}
                animate={{ strokeDashoffset: innerC * (1 - clamp(covered)) }}
                transition={{ ...spring, delay: reduceMotion ? 0 : 0.12 }}
              />
            ) : null}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="form-figure text-[2.125rem] text-ink">{phase.dayNumber}</span>
            <span className="mt-1 text-[0.6875rem] text-ink-3">of {phase.totalDays} days</span>
          </div>
        </div>

        {/* ---------------------------------------------------- the journey */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-serif text-[1.625rem] leading-none tracking-[-0.03em] text-ink">
              {phase.name}
            </h2>
            {/* Only when it adds something. A "Cut" badge beside a phase called
                Cut is the interface repeating itself back at you. */}
            {KIND_WORD[phase.kind] !== phase.name ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--app-accent-wash)] px-3 py-1 text-[0.75rem] font-medium text-[var(--app-accent-deep)]">
                <Flag size={12} weight="fill" />
                {KIND_WORD[phase.kind]}
              </span>
            ) : null}
            <span className="text-[0.8125rem] text-ink-3">{weeks} weeks</span>
          </div>

          {phase.startWeightG !== null && phase.targetWeightG !== null ? (
            <div className="mt-5 flex items-stretch gap-2">
              <Stone
                figure={weightFigure(phase.startWeightG, unit)}
                unit={unit}
                caption="started at"
              />
              <Path />
              <Stone
                figure={currentWeightG !== null ? weightFigure(currentWeightG, unit) : '—'}
                unit={currentWeightG !== null ? unit : ''}
                caption="today"
                lit
              />
              <Path />
              <Stone
                figure={weightFigure(phase.targetWeightG, unit)}
                unit={unit}
                caption="aiming for"
              />
            </div>
          ) : (
            <p className="mt-4 text-[0.9375rem] text-ink-2">No weight target set.</p>
          )}

          <span className="sr-only">
            {covered !== null
              ? `About ${Math.round(covered * 100)} per cent of the way to the target weight, and ${Math.round(
                  elapsed * 100,
                )} per cent of the way through the time.`
              : `${Math.round(elapsed * 100)} per cent of the way through the time.`}
          </span>
        </div>
      </div>
    </section>
  );
}

const KIND_WORD: Record<string, string> = {
  cut: 'Cut',
  maintenance: 'Maintenance',
  'lean-bulk': 'Lean bulk',
  recomp: 'Recomposition',
  custom: 'Custom',
};

/** One weight on the path. Figure first, name underneath — never beside. */
function Stone({
  figure,
  unit,
  caption,
  lit = false,
}: {
  figure: string;
  unit: string;
  caption: string;
  lit?: boolean;
}) {
  return (
    <div
      className={
        lit
          ? 'flex-1 rounded-2xl border border-[var(--app-accent)] bg-[var(--app-accent-wash)] px-3.5 py-3'
          : 'flex-1 rounded-2xl border border-line bg-surface-2 px-3.5 py-3'
      }
    >
      <p className="form-figure whitespace-nowrap text-[1.5rem] text-ink">
        {figure}
        {unit ? <span className="ml-1 text-[0.8125rem] text-ink-3">{unit}</span> : null}
      </p>
      <p className="mt-1 text-[0.6875rem] text-ink-3">{caption}</p>
    </div>
  );
}

/** The gap between two stones, drawn as three dots rather than a rule. */
function Path() {
  return (
    <div className="flex items-center gap-1 px-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1 rounded-full bg-line-strong" />
      ))}
    </div>
  );
}
