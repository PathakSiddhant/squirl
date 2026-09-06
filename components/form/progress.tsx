'use client';

import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { motion } from 'motion/react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { removeMeasurement, saveMeasurement } from '@/app/actions/form';
import { cn } from '@/lib/cn';
import { daysBetween, formatDayLong, type DayString } from '@/lib/date';
import type { DaySummary } from '@/lib/form/log';
import type { PhaseView } from '@/lib/form/phases';
import type { Profile } from '@/lib/form/profile';
import type { FormMeasurement } from '@/lib/form/schema';
import { averageOf, summarise, type Point } from '@/lib/form/trend';
import { formatEnergy, formatLength, formatMacro } from '@/lib/form/units';

import { CompletionGraph } from './completion-graph';
import { InlineInput } from './inline-input';
import { WeightChart } from './weight-chart';

/**
 * Am I actually moving?
 *
 * ## What is deliberately not here
 *
 * No engagement metrics. Nothing counts how many days the app was opened, how
 * consistent anybody has been, or what percentage of targets were hit this
 * month held up as a score. §44 rules those out and they are worth naming,
 * because they are what most of this page would be in any other product.
 *
 * What is here answers one question in three ways: what the body did, what was
 * actually eaten against what was planned, and what the days looked like.
 */

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 3650, label: 'All of it' },
];

const SITES = ['Waist', 'Chest', 'Arm', 'Thigh', 'Hips'];

export function Progress({
  phase,
  profile,
  weights,
  trend,
  range,
  measurements,
  today,
}: {
  phase: PhaseView | null;
  profile: Profile;
  weights: Point[];
  trend: ReturnType<typeof summarise>;
  range: DaySummary[];
  measurements: FormMeasurement[];
  today: DayString;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [span, setSpan] = useState(30);
  const [addingSite, setAddingSite] = useState<string | null>(null);

  const windowed = useMemo(
    () => weights.filter((point) => daysBetween(point.day, today) <= span),
    [weights, span, today],
  );

  const recent = useMemo(
    () => range.filter((day) => daysBetween(day.day, today) <= span),
    [range, span, today],
  );

  const run = (action: () => Promise<unknown>) =>
    start(async () => {
      await action();
      router.refresh();
    });

  // Averages skip what is not known rather than treating an absence as zero.
  const avgEnergy = averageOf(recent.map((day) => day.energyMcal));
  const avgProtein = averageOf(recent.map((day) => day.proteinMg));
  const tracked = recent.filter((day) => day.hasFood).length;
  const untracked = recent.filter((day) => day.nutritionUntracked).length;

  const energyTarget = phase?.metrics.find((m) => m.metric === 'energy')?.target ?? null;
  const proteinTarget = phase?.metrics.find((m) => m.metric === 'protein')?.target ?? null;

  const bySite = useMemo(() => {
    const map = new Map<string, FormMeasurement[]>();
    for (const row of measurements) {
      const list = map.get(row.site);
      if (list) list.push(row);
      else map.set(row.site, [row]);
    }
    return map;
  }, [measurements]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(21rem,1fr)] xl:items-start">
      <div className="flex flex-col gap-4">
        {/* --------------------------------------------------------- weight */}
        <section className="form-panel rounded-[1.75rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-[1.625rem] leading-none tracking-[-0.03em] text-ink">
                What the body did
              </h1>
              {trend.ratePerWeekG !== null && trend.samples >= 3 ? (
                <p className="mt-2 flex items-center gap-1.5 text-[0.875rem] text-ink-2">
                  {trend.direction === 'down' ? (
                    <ArrowDown size={13} weight="bold" className="text-[var(--form-met)]" />
                  ) : trend.direction === 'up' ? (
                    <ArrowUp size={13} weight="bold" className="text-[var(--app-accent)]" />
                  ) : null}
                  {trend.direction === 'flat'
                    ? 'Holding steady'
                    : `${Math.abs(trend.ratePerWeekG / 1000).toFixed(2)} ${profile.weightUnit} a week`}
                  <span className="text-ink-3">· the trend, not today</span>
                </p>
              ) : (
                <p className="mt-2 text-[0.875rem] text-ink-3">
                  Three readings and the trend appears.
                </p>
              )}
            </div>

            {/* The window, as one control rather than four loose buttons. */}
            <div className="flex gap-1 rounded-[1rem] border border-[var(--form-edge)] bg-surface-2 p-1">
              {RANGES.map((option) => (
                <button
                  key={option.days}
                  type="button"
                  onClick={() => setSpan(option.days)}
                  aria-pressed={span === option.days}
                  className={cn(
                    'relative whitespace-nowrap rounded-[0.75rem] px-3 py-1.5 text-[0.8125rem]',
                    'transition-colors duration-[var(--t-state)]',
                    span === option.days ? 'text-ink-invert' : 'text-ink-3 hover:text-ink',
                  )}
                >
                  {span === option.days ? (
                    <motion.span
                      layoutId="progress-window"
                      transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                      className="absolute inset-0 rounded-[0.75rem] bg-ink"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="relative">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            {windowed.length >= 2 ? (
              <WeightChart
                points={windowed}
                unit={profile.weightUnit}
                targetG={phase?.targetWeightG ?? null}
              />
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--form-edge)] px-6 py-16 text-center text-[0.9375rem] text-ink-3">
                Two readings and a line appears here.
              </p>
            )}
          </div>
        </section>

        {/* ----------------------------------------------------------- days */}
        <section className="form-panel rounded-[1.75rem] p-5 sm:p-6">
          <CompletionGraph days={range} today={today} weeks={span <= 30 ? 13 : 26} />
        </section>
      </div>

      {/* ------------------------------------------------------- the rail */}
      <div className="flex flex-col gap-4">
        {/* Plan against reality. Averages over the days actually tracked —
            days marked unknown are skipped rather than counted as zero, which
            is why the count of days is stated beside them. */}
        <section className="form-panel rounded-[1.75rem] p-5 sm:p-6">
          <h2 className="font-serif text-[1.375rem] leading-none tracking-[-0.025em] text-ink">
            Plan against reality
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <Stat
              label="Calories"
              value={avgEnergy !== null ? formatEnergy(avgEnergy) : '—'}
              note={energyTarget ? `planned ${formatEnergy(energyTarget)}` : 'a day, on average'}
            />
            <Stat
              label="Protein"
              value={avgProtein !== null ? `${formatMacro(avgProtein)}g` : '—'}
              note={proteinTarget ? `planned ${formatMacro(proteinTarget)}g` : 'a day, on average'}
            />
            <Stat
              label="Days tracked"
              value={`${tracked}`}
              note={`of ${recent.length}${untracked > 0 ? `, ${untracked} unknown` : ''}`}
            />
            <Stat
              label="Weight change"
              value={
                windowed.length >= 2
                  ? `${((windowed[windowed.length - 1].grams - windowed[0].grams) / 1000).toFixed(1)}`
                  : '—'
              }
              note={`${profile.weightUnit} this window`}
            />
          </div>
        </section>

        {/*
          The tape, only if it is part of this person's practice.

          §11 applied to something that is not a daily metric: switched off, it
          leaves the application rather than becoming five empty boxes that
          quietly suggest they ought to be filled in.
        */}
        {profile.trackMeasurements ? (
        <section className="form-panel rounded-[1.75rem] p-5 sm:p-6">
          <h2 className="font-serif text-[1.375rem] leading-none tracking-[-0.025em] text-ink">
            The tape
          </h2>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">
            Often more honest than the scale during a recomposition. Fill in the ones you care
            about; the rest stay empty and quiet.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {SITES.map((site) => {
              const history = bySite.get(site) ?? [];
              const newest = history[0];
              const previous = history[1];
              const delta = newest && previous ? newest.valueMm - previous.valueMm : null;

              return (
                <div
                  key={site}
                  className={cn(
                    'group/site relative rounded-[1.25rem] border p-3.5 transition-[border-color] duration-[var(--t-state)]',
                    newest
                      ? 'border-[var(--form-edge)] bg-surface'
                      : 'border-dashed border-[var(--form-edge)]',
                  )}
                >
                  <InlineInput
                    value={newest ? formatLength(newest.valueMm) : null}
                    placeholder="measure"
                    label={`${site} measurement`}
                    className="form-figure text-[1.5rem] text-ink"
                    inputClassName="w-[7ch]"
                    onSave={(raw) => saveMeasurement(site, raw)}
                  />

                  <p className="mt-1.5 text-[0.8125rem] font-medium text-ink">{site}</p>

                  {delta !== null ? (
                    <p
                      className={cn(
                        'mt-0.5 text-[0.6875rem]',
                        delta < 0 ? 'text-[var(--form-met)]' : 'text-ink-3',
                      )}
                    >
                      {delta > 0 ? '+' : ''}
                      {(delta / 10).toFixed(1)} cm since {formatDayLong(previous.day)}
                    </p>
                  ) : newest ? (
                    <p className="mt-0.5 text-[0.6875rem] text-ink-3">
                      {formatDayLong(newest.day)}
                    </p>
                  ) : null}

                  {newest ? (
                    <button
                      type="button"
                      onClick={() => run(() => removeMeasurement(newest.id))}
                      aria-label={`Remove the latest ${site} measurement`}
                      className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full text-ink-3 opacity-0 transition-opacity duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover/site:opacity-100"
                    >
                      <X size={11} weight="bold" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
        ) : null}
      </div>
    </div>
  );
}

/** One average, figure first. */
function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--form-edge)] bg-surface-2 p-3.5">
      <p className="form-figure text-[1.625rem] leading-none text-ink">{value}</p>
      <p className="mt-2 text-[0.8125rem] font-medium text-ink">{label}</p>
      <p className="mt-0.5 text-[0.6875rem] leading-snug text-ink-3">{note}</p>
    </div>
  );
}
