'use client';

import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { Barbell } from '@phosphor-icons/react/dist/csr/Barbell';
import { Drop } from '@phosphor-icons/react/dist/csr/Drop';
import { ForkKnife } from '@phosphor-icons/react/dist/csr/ForkKnife';
import { MoonStars } from '@phosphor-icons/react/dist/csr/MoonStars';
import { Pill } from '@phosphor-icons/react/dist/csr/Pill';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  addWater,
  markUntracked,
  removeFoodLog,
  saveWeight,
  setMetric,
  toggleMetric,
} from '@/app/actions/form';
import { cn } from '@/lib/cn';
import { IST_TIME_ZONE, type DayString } from '@/lib/date';
import type { FoodView } from '@/lib/form/foods';
import type { DaySummary, DayView } from '@/lib/form/log';
import type { PhaseView } from '@/lib/form/phases';
import type { Profile } from '@/lib/form/profile';
import type { Metric } from '@/lib/form/schema';
import type { Point, Trend } from '@/lib/form/trend';
import {
  formatDuration,
  formatEnergy,
  formatMacro,
  formatVolume,
  parseDuration,
  parseVolume,
  parseWeight,
  weightFigure,
} from '@/lib/form/units';

import { Arc } from './arc';
import { CompletionGraph } from './completion-graph';
import { FoodPicture } from './food-picture';
import { FoodSheet } from './food-sheet';
import { InlineInput } from './inline-input';
import { Pad } from './pad';
import { PhaseCapsule } from './phase-capsule';
import { Spark } from './spark';
import { Tally } from './tally';
import { Vessel } from './vessel';

/**
 * Today.
 *
 * ## Not a dashboard
 *
 * The version before this one was six panels in a two-column grid, each with a
 * ring in it. That is the house style of every fitness product ever shipped,
 * and it had the failure mode those products all have: the columns were
 * different heights, so a third of the screen was empty, and every quantity
 * looked like every other quantity because they were all drawn with the same
 * instrument.
 *
 * So Today is one sheet, and each reading gets the instrument its own physics
 * suggests:
 *
 *   weight     a figure, because it is a single number you write down
 *   fuel       an arc, because it is spent against a limit
 *   protein    a tally, because it is accumulated in servings
 *   water      a vessel, because water fills things
 *   the rest   keys, because they are pressed and then forgotten
 *
 * You can tell them apart from across the room, which is the actual test. The
 * zones inside the sheet are separated by space and by a change of scale — not
 * by rules, and not by nesting a card inside a card.
 *
 * ## Everything is optimistic
 *
 * The local database is the authority, the write cannot fail in a way the
 * reader could act on, and a control that waits for a round trip before moving
 * is a control that feels broken by the fifth tap.
 */
export function Today({
  day,
  phase,
  profile,
  view,
  trend,
  series,
  recent,
  foods,
}: {
  day: DayString;
  phase: PhaseView;
  profile: Profile;
  view: DayView;
  trend: Trend;
  series: Point[];
  recent: DaySummary[];
  foods: FoodView[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const reduceMotion = useReducedMotion();

  const rule = (metric: Metric) => view.rules.find((row) => row.metric === metric);
  const on = (metric: Metric) => rule(metric)?.enabled ?? false;
  const target = (metric: Metric) => rule(metric)?.target ?? null;
  const read = (metric: Metric) => view.readings[metric]?.value ?? null;

  const run = (action: () => Promise<unknown>) =>
    start(async () => {
      await action();
      router.refresh();
    });

  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${day}T06:00:00Z`));

  const share = (metric: Metric) => {
    const goal = target(metric);
    const value = read(metric);
    if (!goal || goal <= 0 || value === null) return 0;
    return value / goal;
  };

  const pictures = new Map(foods.map((food) => [food.id, food.image ?? null]));

  const done = view.verdict.status === 'complete';
  const energyOver =
    rule('energy')?.direction === 'at-most' && share('energy') > 1 && !view.nutritionUntracked;

  return (
    /*
      Two columns, not one long scroll.

      Everything used to sit in a single centred sheet with a third of the
      window empty on either side of it, which is both a waste of the screen
      and a page you have to travel down to reach the bottom of. The wide
      column carries the instruments, which want room; the rail carries the two
      things you come back to repeatedly — the scale, and what you have eaten.
    */
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(22rem,1fr)] xl:items-start">
      <div className="flex flex-col gap-4 xl:col-span-2 xl:contents">
      <div className="flex flex-col gap-4">
        <PhaseCapsule
          phase={phase}
          currentWeightG={view.weightG}
          unit={profile.weightUnit}
          today={day}
        />

      <section className="form-panel rounded-[1.75rem] p-5 sm:p-7">
        {/* ----------------------------------------------- the instruments */}
        <div className="grid gap-x-6 gap-y-9 sm:grid-cols-3 sm:items-end">
          {on('energy') && (
            <div className="flex flex-col items-center">
              <Arc
                size={212}
                fraction={share('energy')}
                over={energyOver}
                unknown={view.nutritionUntracked}
                reading={
                  view.nutritionUntracked
                    ? 'unknown'
                    : read('energy') === null
                      ? '0'
                      : formatEnergy(read('energy')!)
                }
                goal={target('energy') ? `${formatEnergy(target('energy')!)} kcal` : undefined}
              />
              <p className="text-[0.9375rem] font-medium text-ink">
                {energyOver ? 'Over the allowance' : 'Fuel'}
              </p>
            </div>
          )}

          {on('protein') && (
            <div className="flex flex-col items-center">
              <span className="form-figure text-[2.5rem] leading-none text-ink">
                {view.nutritionUntracked ? 'unknown' : `${formatMacro(read('protein') ?? 0)}g`}
              </span>
              {target('protein') ? (
                <span className="mt-2 text-[0.8125rem] text-ink-3">
                  of {formatMacro(target('protein')!)}g
                </span>
              ) : null}
              <Tally
                className="mt-5 w-full max-w-[15rem]"
                fraction={view.nutritionUntracked ? 0 : share('protein')}
              />
              <p className="mt-4 text-[0.9375rem] font-medium text-ink">Protein</p>
            </div>
          )}

          {on('water') && (
            <div className="flex flex-col items-center">
              <Vessel
                fraction={share('water')}
                reading={
                  read('water') === null ? '0' : formatVolume(read('water')!, profile.volumeUnit)
                }
                goal={
                  target('water') ? formatVolume(target('water')!, profile.volumeUnit) : undefined
                }
              />

              <div className="mt-4 flex items-center gap-1.5">
                {[250, 500].map((ml) => (
                  <button
                    key={ml}
                    type="button"
                    onClick={() => run(() => addWater(ml, day))}
                    className={cn(
                      'rounded-full border border-[var(--form-edge)] bg-surface px-2.5 py-1.5 text-[0.75rem] text-ink-2',
                      'transition-[border-color,color,translate,background-color] duration-[var(--t-state)] ease-[var(--ease)]',
                      'hover:-translate-y-0.5 hover:border-[var(--form-water)] hover:bg-[var(--form-water-wash)] hover:text-ink active:translate-y-0',
                    )}
                  >
                    +{ml}
                  </button>
                ))}
                <InlineInput
                  value={null}
                  placeholder="exact"
                  label="Set water total"
                  inputClassName="w-[8ch]"
                  preview={(raw) => {
                    const parsed = parseVolume(raw, profile.volumeUnit);
                    return parsed ? formatVolume(parsed.value, profile.volumeUnit) : 'not an amount';
                  }}
                  onSave={(raw) => setMetric('water', raw, day)}
                />
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-[0.9375rem] font-medium text-ink">
                <Drop size={14} weight="fill" className="text-[var(--form-water)]" />
                Water
              </p>
            </div>
          )}
        </div>


        {/*
          The keys, in the same panel as the dials rather than floating in the
          rail as their own group of pills. They answer the same question the
          dials do — what did today contain — and giving three toggles a panel
          of their own was the layout inventing a section that does not exist.
        */}
        {(on('creatine') || on('movement') || on('sleep')) && (
          <div className="mt-7 grid gap-2.5 sm:grid-cols-3">
            {on('creatine') && (
              <Pad
                label="Creatine"
                icon={Pill}
                on={(read('creatine') ?? 0) > 0}
                note={(read('creatine') ?? 0) > 0 ? 'taken' : 'not yet'}
                onToggle={() => run(() => toggleMetric('creatine', day))}
              />
            )}

            {on('movement') && (
              <Pad
                label="Movement"
                icon={Barbell}
                on={
                  target('movement') !== null
                    ? (read('movement') ?? 0) >= target('movement')!
                    : (read('movement') ?? 0) > 0
                }
                note={
                  read('movement') !== null && read('movement')! > 1
                    ? `${read('movement')!.toLocaleString('en-IN')} steps`
                    : (read('movement') ?? 0) > 0
                      ? 'moved'
                      : 'not yet'
                }
                onToggle={() => run(() => toggleMetric('movement', day))}
                tone="var(--form-met)"
              />
            )}

            {on('sleep') && (
              <div className="flex min-w-0 items-center gap-3.5 rounded-[1.25rem] border border-[var(--form-edge)] bg-surface p-3.5 shadow-[var(--shadow-press)]">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-ink-3">
                  <MoonStars size={21} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[1rem] font-medium text-ink">Slept</span>
                  <span className="mt-0.5 flex items-baseline gap-1.5">
                    <InlineInput
                      value={read('sleep') !== null ? formatDuration(read('sleep')!) : null}
                      placeholder="how long?"
                      label="Sleep last night"
                      className="form-figure text-[1.25rem] text-ink"
                      inputClassName="w-[8ch]"
                      preview={(raw) => {
                        const minutes = parseDuration(raw);
                        return minutes ? formatDuration(minutes) : 'try 7h 30m or 7:30';
                      }}
                      onSave={(raw) => setMetric('sleep', raw, day)}
                    />
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </section>

        <section className="form-panel rounded-[1.75rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-[1.375rem] leading-none tracking-[-0.025em] text-ink">
              What you ate
            </h2>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-full bg-[var(--app-accent)] px-4 py-2.5',
                'text-[0.875rem] font-medium text-white',
                'transition-[translate,box-shadow] duration-[var(--t-state)] ease-[var(--ease)]',
                'hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]',
              )}
            >
              <Plus size={13} weight="bold" />
              Add food
            </button>
          </div>

          <FoodList
            foods={view.foods}
            pictures={pictures}
            onRemove={(id) => run(() => removeFoodLog(id))}
          />

          {/*
            "I could not track today." One tap, never hidden in a menu, and
            never phrased as a confession — the alternative is that somebody
            invents a number or stops opening the app (§33).
          */}
          <button
            type="button"
            onClick={() => run(() => markUntracked(!view.nutritionUntracked, day))}
            aria-pressed={view.nutritionUntracked}
            className={cn(
              'mt-3 text-[0.8125rem] underline-offset-4 transition-colors duration-[var(--t-state)]',
              view.nutritionUntracked
                ? 'text-ink underline'
                : 'text-ink-3 hover:text-ink hover:underline',
            )}
          >
            {view.nutritionUntracked
              ? 'Today’s food is marked unknown. Undo'
              : 'Ate out and lost track? Mark today unknown'}
          </button>
        </section>
      </div>

      {/* ------------------------------------------------- the right rail */}
      <div className="flex flex-col gap-4">
        <WeightPanel
          dateLabel={dateLabel}
          day={day}
          profile={profile}
          view={view}
          trend={trend}
          series={series}
        />

        {/* The days. Narrow enough for the rail at a quarter's worth. */}
        <section className="form-panel rounded-[1.75rem] p-5 sm:p-6">
          <CompletionGraph days={recent} today={day} weeks={13} />
        </section>
      </div>
      </div>

      {/* A quiet acknowledgement. §82 asks for a state change, not confetti. */}
      <AnimatePresence>
        {done ? (
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-[var(--form-met)] bg-[var(--form-met-wash)] px-5 py-3.5 text-[0.9375rem] text-ink"
          >
            Everything this phase asked for today has been met.
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {adding ? (
          <FoodSheet
            day={day}
            foods={foods}
            onClose={() => setAdding(false)}
            onDone={() => {
              setAdding(false);
              router.refresh();
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * The scale, at the top of the rail.
 *
 * It is the first thing on the page and it is deliberately the largest figure
 * in the application: on most days the entire interaction with Form is opening
 * it, typing one number here, and closing it again. Everything else on the
 * screen is optional in a way this is not.
 *
 * The trend sits directly underneath rather than off to one side, because the
 * two are one thought — today's reading is noise, and the line under it is the
 * only part that means anything (§16). Below three readings there is no line
 * to draw, so the space says what is missing instead of drawing a flat one.
 */
function WeightPanel({
  dateLabel,
  day,
  profile,
  view,
  trend,
  series,
}: {
  dateLabel: string;
  day: DayString;
  profile: Profile;
  view: DayView;
  trend: Trend;
  series: Point[];
}) {
  return (
    <section className="form-panel overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
      <p className="text-[0.8125rem] text-ink-3">{dateLabel}</p>

      <div className="mt-2 flex items-baseline gap-2.5">
        <InlineInput
          value={view.weightG !== null ? weightFigure(view.weightG, profile.weightUnit) : null}
          placeholder="weigh in"
          label="Weight today"
          size="lg"
          className="form-figure text-[clamp(3rem,7vw,4.5rem)] leading-[0.88] text-ink"
          inputClassName="w-[6ch]"
          preview={(raw) => {
            const parsed = parseWeight(raw, profile.weightUnit);
            return parsed
              ? `${weightFigure(parsed.value, parsed.unit)} ${parsed.unit}${
                  parsed.assumed ? ' (assumed)' : ''
                }`
              : 'not a weight';
          }}
          onSave={(raw) => saveWeight(raw, day)}
        />
        {view.weightG !== null ? (
          <span className="text-[1.25rem] text-ink-3">{profile.weightUnit}</span>
        ) : null}
      </div>

      {trend.ratePerWeekG !== null && trend.samples >= 3 ? (
        <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[var(--form-edge)] bg-surface-2 px-4 py-3">
          <div>
            <p className="flex items-center gap-1.5 text-[1.0625rem] font-medium text-ink">
              {trend.direction === 'down' ? (
                <ArrowDown size={13} weight="bold" className="text-[var(--form-met)]" />
              ) : trend.direction === 'up' ? (
                <ArrowUp size={13} weight="bold" className="text-[var(--app-accent)]" />
              ) : null}
              {trend.direction === 'flat'
                ? 'Holding'
                : `${Math.abs(trend.ratePerWeekG / 1000).toFixed(2)} ${profile.weightUnit}`}
            </p>
            <p className="mt-0.5 text-[0.75rem] text-ink-3">a week, over {trend.samples} readings</p>
          </div>
          <Spark points={series} width={104} height={38} />
        </div>
      ) : (
        <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-3">
          {view.weightG === null
            ? 'Step on the scale and write the number down. Three of them and the trend appears here.'
            : 'Two more readings and the trend appears here.'}
        </p>
      )}
    </section>
  );
}

/** What has been eaten, in the order it was eaten. */
function FoodList({
  foods,
  pictures,
  onRemove,
}: {
  foods: DayView['foods'];
  /*
    A log row carries its own name and its own numbers on purpose — editing a
    food must never rewrite what last March contained — so it does not carry a
    picture either. The library is consulted for one, and a row whose food has
    since been deleted simply falls back to its icon.
  */
  pictures: Map<string, string | null>;
  onRemove: (id: string) => void;
}) {
  if (foods.length === 0) {
    return (
      <div className="mt-4 flex items-center gap-3.5 rounded-2xl bg-surface-2 px-4 py-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-ink-3">
          <ForkKnife size={20} />
        </span>
        <p className="text-[0.9375rem] text-ink-2">
          Nothing yet today.
          <span className="block text-[0.8125rem] text-ink-3">
            Anything you add shows up here, newest last.
          </span>
        </p>
      </div>
    );
  }

  return (
    /*
      One line per thing eaten, two columns wide.

      The earlier version gave every row a picture, a name, a portion, a
      calorie figure and a protein figure stacked over two lines, which came to
      seventy pixels a row — eleven of those is a column of food taller than
      the rest of the screen put together. A day's eating is a list you scan,
      not a set of cards you study.
    */
    <ul className="mt-4 grid gap-1.5 lg:grid-cols-2">
      <AnimatePresence initial={false}>
        {foods.map((food) => (
          <motion.li
            key={food.id}
            layout
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="group/food flex items-center gap-2.5 rounded-xl bg-surface-2 py-1.5 pl-1.5 pr-2.5 transition-colors duration-[var(--t-state)] hover:bg-surface-3"
          >
            <FoodPicture
              name={food.name}
              image={food.foodId ? pictures.get(food.foodId) : null}
              size={30}
            />

            <span className="min-w-0 flex-1 truncate text-[0.875rem] text-ink">
              {food.name}
              <span className="ml-1.5 text-[0.75rem] text-ink-3">
                {(food.quantity / 1000).toFixed(food.quantity % 1000 === 0 ? 0 : 1)} {food.unit}
              </span>
            </span>

            <span className="form-figure shrink-0 text-[1rem] text-ink">
              {formatEnergy(food.energyMcal)}
            </span>
            <span className="w-[3.25rem] shrink-0 text-right text-[0.75rem] text-ink-3">
              {formatMacro(food.proteinMg)} g&nbsp;P
            </span>

            <button
              type="button"
              onClick={() => onRemove(food.id)}
              aria-label={`Remove ${food.name}`}
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-3 opacity-0 transition-opacity duration-[var(--t-state)] hover:bg-surface hover:text-ink focus-visible:opacity-100 group-hover/food:opacity-100"
            >
              <X size={10} weight="bold" />
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
