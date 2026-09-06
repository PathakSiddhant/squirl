import { cn } from '@/lib/cn';
import { elapsedFraction, weightProgress } from '@/lib/form/calc';
import type { PhaseView } from '@/lib/form/phases';
import { weightFigure, type WeightUnit } from '@/lib/form/units';

/**
 * The phase, drawn as a measure.
 *
 * Two quantities are plotted on one scale, which is the entire point of
 * drawing it rather than writing it:
 *
 *   the pale fill    how much of the *time* has gone
 *   the solid fill   how far the *body* has actually come
 *
 * Seeing those two apart is the most useful glance in the product. A phase
 * sixty per cent through the calendar and twenty per cent through the weight
 * is a phase worth thinking about, and no arrangement of numbers in a card
 * makes that as immediate as two lengths on one line.
 *
 * It is never a score. There is no red, no "behind schedule" and no
 * exhortation: the fills sit where they sit and the reader draws their own
 * conclusion, which is the only honest thing to do with a signal this noisy.
 */

interface Reading {
  elapsed: number;
  covered: number | null;
  markerAt: number | null;
}

function read(phase: PhaseView, currentWeightG: number | null, today: string): Reading {
  const elapsed = elapsedFraction(phase.startDay, phase.targetDay, today);

  const covered =
    currentWeightG !== null && phase.startWeightG !== null && phase.targetWeightG !== null
      ? weightProgress(phase.startWeightG, currentWeightG, phase.targetWeightG)
      : null;

  return {
    elapsed,
    covered,
    // Clamped for drawing only. Overshooting and going backwards are both real
    // things that happen, and the figure beneath still reports them honestly.
    markerAt: covered === null ? null : Math.min(Math.max(covered, 0), 1),
  };
}

/** The rail's version: vertical, tall, the length of the column. */
export function PhaseColumn({
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
  const { elapsed, covered, markerAt } = read(phase, currentWeightG, today);

  return (
    <div className="flex gap-3">
      <div className="relative w-[3px] shrink-0 overflow-hidden rounded-full bg-line">
        <div
          className="absolute inset-x-0 top-0 rounded-full bg-line-strong"
          style={{ height: `${elapsed * 100}%` }}
          aria-hidden="true"
        />
        {markerAt !== null ? (
          <div
            className="absolute inset-x-0 top-0 rounded-full bg-[var(--app-accent)] transition-[height] duration-[var(--t-layout)] ease-[var(--ease)]"
            style={{ height: `${markerAt * 100}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[1.0625rem] tracking-[-0.02em] text-ink">
          {phase.name}
        </p>
        <p className="mt-0.5 text-[0.75rem] text-ink-3">
          day {phase.dayNumber} of {phase.totalDays}
        </p>

        {phase.startWeightG !== null && phase.targetWeightG !== null ? (
          <p className="mt-2.5 flex flex-col text-[0.75rem] text-ink-3">
            <span className="form-figure text-[1.125rem] text-ink">
              {weightFigure(currentWeightG ?? phase.startWeightG, unit)}
              <span className="ml-1 text-[0.75rem] text-ink-3">{unit}</span>
            </span>
            <span className="mt-0.5">
              {weightFigure(phase.targetWeightG, unit)} {unit} to go for
            </span>
          </p>
        ) : null}

        <span className="sr-only">
          {covered !== null
            ? `About ${Math.round(covered * 100)} per cent of the way to the target weight.`
            : ''}
        </span>
      </div>
    </div>
  );
}

/** The narrow-screen version: the same two quantities, laid across. */
export function PhaseStrip({
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
  const { elapsed, markerAt } = read(phase, currentWeightG, today);

  return (
    <div className="w-full">
      <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-line">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-line-strong"
          style={{ width: `${elapsed * 100}%` }}
          aria-hidden="true"
        />
        {markerAt !== null ? (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--app-accent)] transition-[width] duration-[var(--t-layout)] ease-[var(--ease)]"
            style={{ width: `${markerAt * 100}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-2 text-[0.8125rem]">
          <span className="font-medium text-ink">{phase.name}</span>
          <span className="text-ink-3">
            day {phase.dayNumber} of {phase.totalDays}
          </span>
        </p>

        {phase.targetWeightG !== null ? (
          <p className="flex items-baseline gap-1.5 text-[0.8125rem] text-ink-3">
            <span className={cn(currentWeightG !== null && 'text-ink-2')}>
              {weightFigure(currentWeightG ?? phase.startWeightG ?? 0, unit)}
            </span>
            <span aria-hidden="true">→</span>
            <span>
              {weightFigure(phase.targetWeightG, unit)} {unit}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
