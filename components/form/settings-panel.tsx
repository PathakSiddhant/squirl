'use client';

import { Barbell } from '@phosphor-icons/react/dist/csr/Barbell';
import { Bread } from '@phosphor-icons/react/dist/csr/Bread';
import { Cookie } from '@phosphor-icons/react/dist/csr/Cookie';
import { Drop } from '@phosphor-icons/react/dist/csr/Drop';
import { Fire } from '@phosphor-icons/react/dist/csr/Fire';
import { Leaf } from '@phosphor-icons/react/dist/csr/Leaf';
import { MoonStars } from '@phosphor-icons/react/dist/csr/MoonStars';
import { PersonSimpleRun } from '@phosphor-icons/react/dist/csr/PersonSimpleRun';
import { Pill } from '@phosphor-icons/react/dist/csr/Pill';
import { Ruler } from '@phosphor-icons/react/dist/csr/Ruler';
import { Scales } from '@phosphor-icons/react/dist/csr/Scales';
import { Smiley } from '@phosphor-icons/react/dist/csr/Smiley';
import type { Icon } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { changeTarget, saveProfile, toggleTracking } from '@/app/actions/form';
import { cn } from '@/lib/cn';
import { ACTIVITY_LABEL, ACTIVITY_LEVELS } from '@/lib/form/calc';
import type { PhaseView } from '@/lib/form/phases';
import type { Profile } from '@/lib/form/profile';
import { METRICS, type Metric } from '@/lib/form/schema';
import { formatDuration, formatHeight, formatMacro, formatVolume } from '@/lib/form/units';

import { InlineInput } from './inline-input';
import { Segment } from './segment';

/**
 * What Form tracks, and how it reads things back.
 *
 * ## Why this was rebuilt
 *
 * The first version was a column of rows, each with a word on the left and its
 * value pushed to the far right of a wide page. Every line asked the reader to
 * hold a label in their head while their eye travelled across a gap of
 * nothing, eight times over, and nothing on the screen said which settings
 * belonged together. It was, precisely, a form.
 *
 * Now every metric is a card you can switch on and off with its own icon and
 * its own target inside it, and every preference is one control with its name
 * directly above it. Nothing is a label facing a value across a chasm.
 *
 * ## Off means gone
 *
 * §11 is unusually specific about this and it is worth honouring exactly: a
 * metric switched off does not become a row of em dashes somewhere, it leaves
 * the product. It disappears from Today, from the day's judgement and from the
 * completion graph, because a placeholder for something you deliberately chose
 * not to track is worse than no placeholder — it is a small daily reminder
 * that the app disagrees with your decision.
 *
 * ## Targets change forward only
 *
 * Editing a target here writes a new row into the phase's history rather than
 * overwriting the old one, so every day already lived keeps being judged
 * against whatever was in force when it happened (§60, §61). Nothing changed
 * today rewrites last Monday.
 */

const LABEL: Record<Metric, string> = {
  weight: 'Weight',
  energy: 'Calories',
  protein: 'Protein',
  carbs: 'Carbohydrate',
  fat: 'Fat',
  fiber: 'Fibre',
  water: 'Water',
  creatine: 'Creatine',
  movement: 'Movement',
  sleep: 'Sleep',
  mood: 'Energy & soreness',
};

const GLYPH: Record<Metric, Icon> = {
  weight: Scales,
  energy: Fire,
  protein: Barbell,
  carbs: Bread,
  fat: Cookie,
  fiber: Leaf,
  water: Drop,
  creatine: Pill,
  movement: PersonSimpleRun,
  sleep: MoonStars,
  mood: Smiley,
};

const NOTE: Partial<Record<Metric, string>> = {
  weight: 'Measured, never scored',
  energy: 'Summed from what you log',
  mood: 'Out of ten, if useful',
};

/** Metrics with nothing to set a number against. */
const NO_TARGET: ReadonlySet<Metric> = new Set(['creatine', 'mood']);

export function SettingsPanel({ profile, phase }: { profile: Profile; phase: PhaseView | null }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ error: string | null }>) =>
    start(async () => {
      const result = await action();
      setError(result.error);
      router.refresh();
    });

  const metricRow = (metric: Metric) => phase?.metrics.find((row) => row.metric === metric);

  /** Targets read and write in the unit a person would say out loud. */
  const targetText = (metric: Metric): string | null => {
    const row = metricRow(metric);
    if (!row || row.target === null) return null;
    switch (metric) {
      case 'energy':
        return String(Math.round(row.target / 1000));
      case 'protein':
      case 'carbs':
      case 'fat':
      case 'fiber':
        return formatMacro(row.target);
      case 'water':
        return formatVolume(row.target, profile.volumeUnit);
      case 'sleep':
        return formatDuration(row.target);
      case 'movement':
        return row.target.toLocaleString('en-IN');
      case 'weight':
        return (row.target / 1000).toFixed(1);
      default:
        return String(row.target);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)] xl:items-start">
      {/* ---------------------------------------------------- what is tracked */}
      <section className="form-panel rounded-[1.75rem] p-5 sm:p-6">
        <h1 className="font-serif text-[2rem] leading-none tracking-[-0.03em] text-ink">
          What Form watches
        </h1>
        <p className="mt-2.5 max-w-[42rem] text-[0.9375rem] leading-relaxed text-ink-2">
          Switch anything off and it leaves the daily screen entirely and stops counting toward
          whether a day was complete. It is not hidden — it is not tracked.
        </p>

        {!phase ? (
          <p className="mt-6 text-[0.9375rem] text-ink-3">
            No phase is running, so there is nothing to configure yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {METRICS.map((metric) => {
              const row = metricRow(metric);
              if (!row) return null;

              return (
                <MetricCard
                  key={metric}
                  metric={metric}
                  enabled={row.enabled}
                  target={targetText(metric)}
                  onToggle={() => run(() => toggleTracking(phase.id, metric, !row.enabled))}
                  onTarget={(raw) => changeTarget(phase.id, metric, raw)}
                />
              );
            })}

            {/*
              Not a phase metric, and deliberately in the same grid as them.

              The tape is not judged daily and has no target, so it has no row
              in `form_phase_metrics` — but "is Form watching this?" is one
              question, and splitting the answer across two parts of the page
              would be filing rather than design.
            */}
            <MeasureCard
              enabled={profile.trackMeasurements}
              onToggle={() =>
                run(() => saveProfile({ trackMeasurements: !profile.trackMeasurements }))
              }
            />
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- preferences */}
      <div className="flex flex-col gap-4">
        <section className="form-panel rounded-[1.75rem] p-5 sm:p-6">
          <h2 className="font-serif text-[1.375rem] leading-none tracking-[-0.025em] text-ink">
            How things read back
          </h2>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">
            Display only. Type in whatever unit comes to hand and Form works out which one you
            meant.
          </p>

          <div className="mt-5 flex flex-col gap-4">
            <Segment
              label="Weight"
              options={[
                { id: 'kg', label: 'Kilograms' },
                { id: 'lb', label: 'Pounds' },
              ]}
              value={profile.weightUnit}
              onPick={(value) => run(() => saveProfile({ weightUnit: value }))}
            />
            <Segment
              label="Height"
              options={[
                { id: 'cm', label: 'Centimetres' },
                { id: 'ft', label: 'Feet & inches' },
              ]}
              value={profile.heightUnit}
              onPick={(value) => run(() => saveProfile({ heightUnit: value }))}
            />
            <Segment
              label="Water"
              options={[
                { id: 'ml', label: 'Litres' },
                { id: 'oz', label: 'Ounces' },
              ]}
              value={profile.volumeUnit}
              onPick={(value) => run(() => saveProfile({ volumeUnit: value }))}
            />
            <Segment
              label="Weighing in"
              hint="Expects, not demands. A skipped weigh-in is never counted against a day, because a day-to-day figure is mostly water anyway."
              options={[
                { id: 'daily', label: 'Every day' },
                { id: 'often', label: 'A few times' },
                { id: 'weekly', label: 'Weekly' },
              ]}
              value={profile.weighCadence}
              onPick={(value) => run(() => saveProfile({ weighCadence: value }))}
            />
          </div>
        </section>

        {/* -------------------------------------------------------------- you */}
        <section className="form-panel rounded-[1.75rem] p-5 sm:p-6">
          <h2 className="font-serif text-[1.375rem] leading-none tracking-[-0.025em] text-ink">
            About you
          </h2>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">
            Used for the calorie estimate and nothing else. Leave anything blank and the estimate
            gets rougher, and says so.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <Stat
              caption="Height"
              value={profile.heightMm ? formatHeight(profile.heightMm, profile.heightUnit) : null}
              placeholder="add"
              label="Height"
              onSave={(raw) => saveProfile({ height: raw })}
            />
            <Stat
              caption="Born"
              value={profile.birthYear ? String(profile.birthYear) : null}
              placeholder="year"
              label="Birth year"
              onSave={(raw) => {
                const year = Number(raw.replace(/\D/g, ''));
                return saveProfile({ birthYear: Number.isFinite(year) ? year : null });
              }}
            />
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {/*
              Two options, because the resting-energy equation this feeds has
              two coefficients and no third. Anything else here would be an
              interface pretending to offer a choice the maths cannot use.
            */}
            <Segment
              label="Sex"
              options={[
                { id: 'male', label: 'Male' },
                { id: 'female', label: 'Female' },
              ]}
              value={profile.sex === 'female' ? 'female' : 'male'}
              onPick={(value) => run(() => saveProfile({ sex: value }))}
            />

            <Segment
              label="Usual week"
              options={ACTIVITY_LEVELS.map((level) => ({ id: level, label: ACTIVITY_LABEL[level] }))}
              value={profile.activity}
              onPick={(value) => run(() => saveProfile({ activity: value }))}
            />
          </div>
        </section>

        {/* ------------------------------------------------------------- data */}
        <section className="form-panel rounded-[1.75rem] p-5 sm:p-6">
          <h2 className="font-serif text-[1.375rem] leading-none tracking-[-0.025em] text-ink">
            Your data
          </h2>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-2">
            Everything Form holds lives in{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-ink">data/squirl.db</code> on
            this machine, next to Ledger and Signal. Copy that file and you have copied all of it.
            No account, no server, nothing to export from anywhere else.
          </p>
        </section>

        {error ? <p className="text-[0.875rem] text-[var(--i-owe-text)]">{error}</p> : null}
      </div>
    </div>
  );
}

/** The tape measure, which is a preference rather than a daily target. */
function MeasureCard({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={cn(
        'flex items-center gap-3 rounded-[1.25rem] border p-3.5 text-left',
        'transition-[background-color,border-color,box-shadow] duration-[var(--t-state)]',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--app-accent)]',
        enabled
          ? 'border-[var(--form-edge)] bg-surface shadow-[var(--shadow-press)]'
          : 'border-dashed border-[var(--form-edge)] bg-transparent',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-[var(--t-state)]',
          enabled ? 'bg-[var(--app-accent)] text-white' : 'bg-surface-2 text-ink-3',
        )}
      >
        <Ruler size={19} weight={enabled ? 'fill' : 'regular'} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[0.9375rem] font-medium',
            enabled ? 'text-ink' : 'text-ink-3',
          )}
        >
          Tape measure
        </span>
        <span className="block truncate text-[0.75rem] text-ink-3">Waist, chest, arm, thigh</span>
      </span>

      <span
        className={cn(
          'size-2.5 shrink-0 rounded-full transition-colors duration-[var(--t-state)]',
          enabled ? 'bg-[var(--app-accent)]' : 'bg-surface-3',
        )}
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * One metric, as an object rather than a row.
 *
 * The whole card is the switch. A 14px toggle at the end of a line is a target
 * you have to aim at; a card you can hit anywhere is one you can flick through
 * eleven of without looking. The target inside stops the click from
 * propagating, because editing a number should not also switch the thing off.
 */
function MetricCard({
  metric,
  enabled,
  target,
  onToggle,
  onTarget,
}: {
  metric: Metric;
  enabled: boolean;
  target: string | null;
  onToggle: () => void;
  onTarget: (raw: string) => Promise<{ error: string | null }>;
}) {
  const reduceMotion = useReducedMotion();
  const Glyph = GLYPH[metric];
  const note = NOTE[metric];

  return (
    <div
      className={cn(
        'rounded-[1.25rem] border p-3.5 transition-[background-color,border-color,box-shadow,translate] duration-[var(--t-state)]',
        enabled
          ? 'border-[var(--form-edge)] bg-surface shadow-[var(--shadow-press)]'
          : 'border-dashed border-[var(--form-edge)] bg-transparent',
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className="flex w-full items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--app-accent)]"
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-[var(--t-state)]',
            enabled ? 'bg-[var(--app-accent)] text-white' : 'bg-surface-2 text-ink-3',
          )}
        >
          <Glyph size={19} weight={enabled ? 'fill' : 'regular'} />
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[0.9375rem] font-medium',
              enabled ? 'text-ink' : 'text-ink-3',
            )}
          >
            {LABEL[metric]}
          </span>
          {note ? <span className="block truncate text-[0.75rem] text-ink-3">{note}</span> : null}
        </span>

        {/* A dot rather than a switch: the card already is the switch. */}
        <span
          className={cn(
            'size-2.5 shrink-0 rounded-full transition-colors duration-[var(--t-state)]',
            enabled ? 'bg-[var(--app-accent)]' : 'bg-surface-3',
          )}
          aria-hidden="true"
        />
      </button>

      {enabled && !NO_TARGET.has(metric) ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="mt-3 flex items-baseline gap-2 rounded-xl bg-surface-2 px-3 py-2">
            <span className="text-[0.75rem] text-ink-3">aiming for</span>
            <InlineInput
              value={target}
              placeholder="no target"
              label={`${LABEL[metric]} target`}
              className="form-figure text-[1.125rem] text-ink"
              inputClassName="w-[8ch]"
              onSave={onTarget}
            />
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}

/** A fact about the body: the figure first, its name underneath. */
function Stat({
  caption,
  value,
  placeholder,
  label,
  onSave,
}: {
  caption: string;
  value: string | null;
  placeholder: string;
  label: string;
  onSave: (raw: string) => Promise<{ error: string | null }>;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--form-edge)] bg-surface-2 px-3.5 py-3">
      <InlineInput
        value={value}
        placeholder={placeholder}
        label={label}
        className="form-figure text-[1.5rem] text-ink"
        inputClassName="w-[7ch]"
        onSave={onSave}
      />
      <p className="mt-1.5 text-[0.75rem] text-ink-3">{caption}</p>
    </div>
  );
}
