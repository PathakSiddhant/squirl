'use client';

import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { continuePhase, finishPhase } from '@/app/actions/form';
import { cn } from '@/lib/cn';
import { formatDayLong, type DayString } from '@/lib/date';
import type { PhaseView } from '@/lib/form/phases';
import type { Profile } from '@/lib/form/profile';
import type { Point } from '@/lib/form/trend';
import { weightFigure } from '@/lib/form/units';

import { PhaseCapsule } from './phase-capsule';

/**
 * Every stretch of time there has been.
 *
 * ## Why completed phases are read-only here
 *
 * §101 and §102. A finished phase is a historical record, and a record that
 * changes when you change a setting is not a record. So nothing on this page
 * recomputes: a phase remembers the weight it started at, the weight it aimed
 * for, and the weight it actually finished on, and those three numbers are
 * what it is remembered by forever.
 *
 * ## Why this stopped being a list of full-width rows
 *
 * It was one wide bar per phase, with a name at the far left and a date range
 * at the far right, stretched across the whole window with nothing in the
 * middle. That is a table row pretending to be a card, and it looked exactly
 * like what it was: a layout stretched to fill a space rather than composed to
 * fit one.
 *
 * A phase is now a card the size of its own content, in a grid, with the thing
 * that actually matters — how far the body moved — drawn as a figure rather
 * than written into a sentence. The running one keeps the full dial, because
 * it is the only one still changing.
 */
export function PhaseHistory({
  phases,
  profile,
  weights,
  today,
}: {
  phases: PhaseView[];
  profile: Profile;
  weights: Point[];
  today: DayString;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const reduceMotion = useReducedMotion();

  const active = phases.find((phase) => phase.status === 'active') ?? null;
  const past = phases.filter((phase) => phase.status !== 'active');

  const latest = weights.length > 0 ? weights[weights.length - 1].grams : null;

  const run = (action: () => Promise<unknown>) => {
    setBusy(true);
    start(async () => {
      await action();
      router.refresh();
      setBusy(false);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {active ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] xl:items-start">
          <PhaseCapsule
            phase={active}
            currentWeightG={latest}
            unit={profile.weightUnit}
            today={today}
          />

          {/* The two things you can do to a running phase, as real controls. */}
          <section className="form-panel flex flex-col gap-2.5 rounded-[1.75rem] p-5">
            <p className="text-[0.8125rem] leading-relaxed text-ink-2">
              Ends {formatDayLong(active.targetDay)}. A phase can be finished early or given more
              road — neither is a failure, and both are written into the record.
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => finishPhase(active.id))}
              className="mt-1 flex items-center justify-center gap-2 rounded-full border border-[var(--form-edge)] bg-surface px-4 py-2.5 text-[0.875rem] font-medium text-ink shadow-[var(--shadow-press)] transition-[translate,box-shadow] duration-[var(--t-state)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-panel)] disabled:opacity-50"
            >
              <CheckCircle size={15} weight="fill" />
              Complete this phase
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => continuePhase(active.id, 4))}
              className="rounded-full px-4 py-2 text-[0.8125rem] text-ink-3 transition-colors duration-[var(--t-state)] hover:text-ink disabled:opacity-50"
            >
              Give it four more weeks
            </button>
          </section>
        </div>
      ) : (
        <section className="form-panel flex flex-col items-center rounded-[1.75rem] px-6 py-16 text-center">
          <p className="font-serif text-[1.5rem] tracking-[-0.025em] text-ink">
            Nothing is running.
          </p>
          <p className="mt-2 max-w-[28rem] text-[0.875rem] leading-relaxed text-ink-3">
            One phase at a time, with a start, a target and an end. Everything Form measures is
            measured against the one you are inside.
          </p>
          <Link
            href="/form/new"
            className="mt-6 flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-5 py-3 text-[0.9375rem] font-medium text-white transition-[translate,box-shadow] duration-[var(--t-state)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
          >
            <Plus size={14} weight="bold" />
            Start a phase
          </Link>
        </section>
      )}

      {past.length > 0 ? (
        <section>
          <p className="form-label px-1">
            {past.length} finished {past.length === 1 ? 'phase' : 'phases'}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <AnimatePresence initial={false}>
              {past.map((phase, index) => (
                <motion.article
                  key={phase.id}
                  layout
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 34,
                    delay: reduceMotion ? 0 : Math.min(index * 0.04, 0.24),
                  }}
                  className="form-panel rounded-[1.5rem] p-4 transition-[translate,box-shadow] duration-[var(--t-hover)] ease-[var(--ease-spring)] hover:-translate-y-1 hover:shadow-[var(--shadow-pop)]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="truncate font-serif text-[1.25rem] leading-none tracking-[-0.025em] text-ink">
                      {phase.name}
                    </h2>
                    <span className="shrink-0 text-[0.6875rem] uppercase tracking-[0.08em] text-ink-3">
                      {phase.status === 'planned' ? 'not started' : 'done'}
                    </span>
                  </div>

                  <Moved phase={phase} unit={profile.weightUnit} />

                  <p className="mt-3 text-[0.75rem] text-ink-3">
                    {formatDayLong(phase.startDay)} → {formatDayLong(phase.endedDay ?? phase.targetDay)}
                  </p>

                  {phase.note ? (
                    <p className="mt-2 line-clamp-3 text-[0.8125rem] leading-relaxed text-ink-2">
                      {phase.note}
                    </p>
                  ) : null}
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * How far the body actually went, as two figures and an arrow.
 *
 * Not "you lost 4.5 kg", and not a percentage of the target. Both of those are
 * the product grading a stretch of somebody's life. Two weights and an arrow
 * between them is the whole truth and it takes no position on it.
 */
function Moved({ phase, unit }: { phase: PhaseView; unit: 'kg' | 'lb' }) {
  const from = phase.startWeightG;
  const to = phase.finalWeightG ?? phase.targetWeightG;

  if (from === null || to === null) {
    return <p className="mt-3 text-[0.8125rem] text-ink-3">No weights recorded for it.</p>;
  }

  return (
    <div className="mt-3 flex items-baseline gap-2">
      <span className="form-figure text-[1.5rem] text-ink">{weightFigure(from, unit)}</span>
      <ArrowRight size={13} className="shrink-0 text-ink-3" />
      <span
        className={cn(
          'form-figure text-[1.5rem]',
          phase.finalWeightG !== null ? 'text-ink' : 'text-ink-3',
        )}
      >
        {weightFigure(to, unit)}
      </span>
      <span className="text-[0.75rem] text-ink-3">
        {unit}
        {phase.finalWeightG === null ? ' · aimed for' : ''}
      </span>
    </div>
  );
}
