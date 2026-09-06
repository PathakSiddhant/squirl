'use client';

import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { assessGoal, phraseGoal, startPhase, type GoalAssessment } from '@/app/actions/form';
import { cn } from '@/lib/cn';
import { ACTIVITY_LEVELS, ACTIVITY_NOTE, type ActivityLevel } from '@/lib/form/calc';
import type { Profile } from '@/lib/form/profile';
import type { PhaseKind, Sex } from '@/lib/form/schema';
import {
  formatDuration,
  formatEnergy,
  formatHeight,
  formatMacro,
  formatVolume,
  parseHeight,
} from '@/lib/form/units';

import { RateMeter } from './rate-meter';
import { ScrubNumber } from './scrub-number';

/**
 * Setting up a phase.
 *
 * ## Panels, not a form
 *
 * The first version of this screen was a column of labelled inputs and it was
 * indistinguishable from a settings page. This one is a set of objects: each
 * number being decided gets its own panel, they sit in a column on the left,
 * and the consequences of all three sit in one readout on the right that
 * updates while they are still moving.
 *
 * That arrangement is the argument. On a form, the answer arrives after you
 * submit. Here the question and the answer are on screen together, so setting
 * a goal is something you *steer* rather than something you fill in and hope
 * about (§7).
 *
 * ## Every number is dragged
 *
 * A goal is not entered once, it is tried: 68, then 70, then 72, watching what
 * each does to the calories. `ScrubNumber` makes each of those a gesture
 * rather than a select-all-and-retype, and the readout follows the hand.
 */

/** One word each, so four of them fit on one line without wrapping. */
const SHORT_ACTIVITY: Record<ActivityLevel, string> = {
  sedentary: 'Seated',
  light: 'Light',
  moderate: 'Moderate',
  high: 'Very',
};

const KINDS: Array<{ id: PhaseKind; label: string; note: string }> = [
  { id: 'cut', label: 'Cut', note: 'losing, deliberately' },
  { id: 'maintenance', label: 'Maintain', note: 'holding steady' },
  { id: 'lean-bulk', label: 'Lean bulk', note: 'gaining, slowly' },
  { id: 'recomp', label: 'Recomp', note: 'same weight, new shape' },
  { id: 'custom', label: 'Custom', note: 'your own thing' },
];

export function PhaseSetup({ profile }: { profile: Profile }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [, start] = useTransition();

  const [kind, setKind] = useState<PhaseKind>('cut');
  const [name, setName] = useState('Cut');
  const [current, setCurrent] = useState(72.5);
  const [goal, setGoal] = useState(68);
  const [months, setMonths] = useState(6);

  const [heightCm, setHeightCm] = useState(profile.heightMm ? profile.heightMm / 10 : 170);
  const [sex, setSex] = useState<Sex>(profile.sex === 'female' ? 'female' : 'male');
  const [birthYear, setBirthYear] = useState(profile.birthYear ?? 1998);
  const [activity, setActivity] = useState<ActivityLevel>(profile.activity);

  const [assessment, setAssessment] = useState<GoalAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [own, setOwn] = useState(false);
  const [targets, setTargets] = useState({ energy: 0, protein: 0, water: 0 });

  const weeks = Math.max(Math.round(months * 4.345), 1);
  const holding = kind === 'maintenance';
  const unit = profile.weightUnit;

  const token = useRef(0);
  useEffect(() => {
    const mine = ++token.current;

    const timer = setTimeout(async () => {
      const payload = {
        kind,
        currentWeight: String(current),
        targetWeight: String(holding ? current : goal),
        height: `${heightCm} cm`,
        weeks,
        sex,
        birthYear,
        activity,
      };

      const result = await assessGoal(payload);
      if (mine !== token.current) return;

      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      const next = result as GoalAssessment;
      setAssessment(next);
      if (!own) {
        setTargets({
          energy: Math.round(next.plan.energy / 1000),
          protein: Math.round(next.plan.protein / 1000),
          water: next.plan.water,
        });
      }

      /*
        The sentence, afterwards.

        The verdict is already on screen by now — it is arithmetic and it is
        instant. This is a round trip to a model, so it lands a second or two
        later and quietly replaces the plainer wording. If it never lands,
        nothing was lost: what is already there is a complete answer (§105).
      */
      const better = await phraseGoal(payload).catch(() => ({ sentence: null }));
      if (mine !== token.current || !better.sentence) return;
      setAssessment((live) =>
        live ? { ...live, explanation: better.sentence!, offline: false } : live,
      );
    }, 320);

    return () => clearTimeout(timer);
    // `own` and `targets` are deliberately absent: recomputing because somebody
    // edited their own calorie target would overwrite what they just typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, current, goal, weeks, heightCm, sex, birthYear, activity, holding]);

  const submit = () => {
    setSaving(true);
    start(async () => {
      const result = await startPhase({
        kind,
        name: name.trim() || KINDS.find((k) => k.id === kind)?.label || 'Phase',
        currentWeight: String(current),
        targetWeight: String(holding ? current : goal),
        height: `${heightCm} cm`,
        weeks,
        sex,
        birthYear,
        activity,
        overrides: own
          ? { energy: targets.energy * 1000, protein: targets.protein * 1000, water: targets.water }
          : undefined,
      });

      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
      router.push('/form');
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      <header>
        <h1 className="font-serif text-[clamp(2rem,5vw,2.75rem)] leading-[1.02] tracking-[-0.03em] text-ink">
          Set up a phase
        </h1>
        <p className="mt-2.5 max-w-[38rem] text-[0.9375rem] leading-relaxed text-ink-2">
          One runs at a time. Move the numbers and the plan beside them moves too.
        </p>
      </header>

      <Panel>
        <PanelLabel>What are you doing</PanelLabel>
        <div className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setKind(option.id);
                if (option.id !== 'custom') setName(option.label);
                if (option.id === 'lean-bulk' && goal <= current) setGoal(current + 4);
                if (option.id === 'cut' && goal >= current) setGoal(Math.max(current - 4, 40));
              }}
              aria-pressed={kind === option.id}
              className={cn(
                'rounded-2xl border px-4 py-3 text-left',
                'transition-[border-color,background-color,translate] duration-[var(--t-state)] ease-[var(--ease)]',
                'hover:-translate-y-0.5',
                kind === option.id
                  ? 'border-[var(--app-accent)] bg-[var(--app-accent-wash)]'
                  : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className="block text-[0.9375rem] font-medium text-ink">{option.label}</span>
              <span className="block text-[0.75rem] text-ink-3">{option.note}</span>
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <Dial
            label="Right now I weigh"
            value={current}
            onChange={setCurrent}
            suffix={unit}
            min={30}
            max={300}
            step={0.1}
          />

          {!holding ? (
            <Dial
              label="I want to be"
              value={goal}
              onChange={setGoal}
              suffix={unit}
              min={30}
              max={300}
              step={0.1}
              accent
            />
          ) : (
            <Panel>
              <PanelLabel>I want to be</PanelLabel>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
                Exactly where you are. Calories aim at maintenance and the days are judged on
                everything else.
              </p>
            </Panel>
          )}

          <Dial
            label="Taking about"
            value={months}
            onChange={setMonths}
            suffix={months === 1 ? 'month' : 'months'}
            min={1}
            max={36}
            step={1}
            decimals={0}
          />

          <p className="px-1 text-[0.8125rem] text-ink-3">
            Drag a number to change it. Click one to type it.
          </p>
        </div>

        <div className="lg:sticky lg:top-32">
          <AnimatePresence mode="wait">
            {assessment ? (
              <motion.div
                key="readout"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="form-lit overflow-hidden rounded-[1.5rem] p-6 shadow-[var(--shadow-pop)] sm:p-7"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <PanelLabel>{holding ? 'Holding steady' : 'This pace is'}</PanelLabel>
                    <p className="mt-1 font-serif text-[clamp(1.875rem,5vw,2.5rem)] leading-none tracking-[-0.03em] text-ink">
                      {assessment.verdictLabel}
                    </p>
                  </div>

                  <AnimatePresence>
                    {!assessment.offline ? (
                      <motion.span
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[0.6875rem] text-ink-3"
                      >
                        <Sparkle size={10} weight="fill" className="text-[var(--app-accent)]" />
                        said by Gemini
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </div>

                <p className="mt-3.5 text-[0.9375rem] leading-relaxed text-ink-2">
                  {assessment.explanation}
                </p>

                {!holding ? (
                  <div className="mt-6 rounded-2xl border border-line bg-surface-2 p-4">
                    <RateMeter rate={assessment.rate} verdict={assessment.verdict} />
                  </div>
                ) : null}

                {assessment.verdict === 'unrealistic' || assessment.verdict === 'aggressive' ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-[0.8125rem] text-ink-3">Try</span>
                    {[assessment.fastestSaneWeeks, assessment.comfortableWeeks]
                      .filter((w) => w > 0)
                      .map((w) => Math.max(Math.round(w / 4.345), 1))
                      .filter((m, index, all) => all.indexOf(m) === index && m !== months)
                      .map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMonths(m)}
                          className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[0.8125rem] text-ink-2 transition-[border-color,color,translate] duration-[var(--t-state)] hover:-translate-y-0.5 hover:border-[var(--app-accent)] hover:text-ink"
                        >
                          {m} months
                        </button>
                      ))}
                  </div>
                ) : null}

                <div className="mt-6 border-t border-line pt-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <PanelLabel>{own ? 'Your targets' : 'Where Form would start you'}</PanelLabel>
                    <button
                      type="button"
                      onClick={() => setOwn((value) => !value)}
                      className="text-[0.8125rem] text-ink-3 underline decoration-dotted underline-offset-4 transition-colors duration-[var(--t-state)] hover:text-ink"
                    >
                      {own ? 'use the recommendation' : 'set my own'}
                    </button>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5">
                    <PlanFigure
                      label="calories a day"
                      editable={own}
                      value={targets.energy}
                      onChange={(next) => setTargets((t) => ({ ...t, energy: next }))}
                      min={800}
                      max={6000}
                      step={10}
                      display={formatEnergy(own ? targets.energy * 1000 : assessment.plan.energy)}
                    />
                    <PlanFigure
                      label="grams of protein"
                      editable={own}
                      value={targets.protein}
                      onChange={(next) => setTargets((t) => ({ ...t, protein: next }))}
                      min={40}
                      max={300}
                      step={5}
                      display={formatMacro(own ? targets.protein * 1000 : assessment.plan.protein)}
                    />
                    <PlanFigure
                      label="of water"
                      editable={own}
                      value={targets.water}
                      onChange={(next) => setTargets((t) => ({ ...t, water: next }))}
                      min={500}
                      max={6000}
                      step={100}
                      display={formatVolume(own ? targets.water : assessment.plan.water)}
                    />
                    <div>
                      <dd className="form-figure text-[1.75rem] leading-none text-ink">
                        {formatDuration(assessment.plan.sleep)}
                      </dd>
                      <dt className="mt-1.5 text-[0.8125rem] text-ink-3">of sleep</dt>
                    </div>
                  </dl>

                  {assessment.plan.heldAtFloor ? (
                    <p className="mt-4 rounded-xl bg-[var(--form-partial-wash)] px-3.5 py-2.5 text-[0.8125rem] text-ink-2">
                      Held at the lowest figure this app will recommend. A longer timeline puts it
                      somewhere more comfortable.
                    </p>
                  ) : null}
                  {assessment.plan.basis === 'partial' ? (
                    <p className="mt-3 text-[0.8125rem] text-ink-3">
                      A height and a birth year below would sharpen this.
                    </p>
                  ) : null}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="form-panel h-[22rem] animate-pulse rounded-[1.5rem]"
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <Panel>
        <PanelLabel>A few things the calorie figure needs</PanelLabel>

        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <SmallDial
            label="Height"
            value={heightCm}
            onChange={setHeightCm}
            suffix="cm"
            min={120}
            max={230}
            step={1}
            decimals={0}
            note={formatHeight(Math.round(heightCm * 10), 'ft')}
          />

          <SmallDial
            label="Born"
            value={birthYear}
            onChange={setBirthYear}
            suffix=""
            min={1930}
            max={2020}
            step={1}
            decimals={0}
            note={`${new Date().getFullYear() - birthYear} years old`}
          />

          <div>
            <PanelLabel>Sex</PanelLabel>
            <Segment
              options={[
                { id: 'male', label: 'Male' },
                { id: 'female', label: 'Female' },
              ]}
              value={sex}
              onPick={(next) => setSex(next as Sex)}
            />
          </div>

          <div>
            <PanelLabel>Usual week</PanelLabel>
            <Segment
              options={ACTIVITY_LEVELS.map((level) => ({
                id: level,
                label: SHORT_ACTIVITY[level],
                title: ACTIVITY_NOTE[level],
              }))}
              value={activity}
              onPick={(next) => setActivity(next as ActivityLevel)}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <label className="block min-w-[14rem] flex-1">
            <PanelLabel>Call it</PanelLabel>
            {/* A title rather than a field: no box, no chrome, just the name
                set the way it will appear at the top of every screen. */}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Mini Cut"
              maxLength={48}
              aria-label="Phase name"
              className="mt-1 w-full border-0 bg-transparent p-0 font-serif text-[clamp(1.75rem,4vw,2.25rem)] tracking-[-0.03em] text-ink outline-none placeholder:text-ink-3 focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={!assessment || saving}
            className={cn(
              'group/go inline-flex shrink-0 items-center gap-2.5 rounded-2xl px-6 py-3.5',
              'bg-[var(--app-accent)] text-[1rem] font-medium text-white',
              'transition-[translate,box-shadow,opacity] duration-[var(--t-state)] ease-[var(--ease)]',
              'hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] disabled:translate-y-0 disabled:opacity-40',
            )}
          >
            {saving ? 'Starting…' : 'Start this phase'}
            <ArrowRight
              size={16}
              weight="bold"
              className="transition-transform duration-[var(--t-state)] group-hover/go:translate-x-1"
            />
          </button>
        </div>

        {error ? <p className="mt-4 text-[0.875rem] text-[var(--i-owe-text)]">{error}</p> : null}
      </Panel>
    </div>
  );
}

/** Form's basic surface. Every control lives inside one. */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('form-panel rounded-[1.5rem] p-5 sm:p-6', className)}>{children}</section>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return <span className="form-label block">{children}</span>;
}

/**
 * One number being decided, in its own panel.
 *
 * Large enough to grab with a thumb, and the only thing in the panel — which
 * is what makes the left column read as three decisions rather than as a form
 * with three rows.
 */
function Dial({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  step,
  decimals = 1,
  accent = false,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  suffix: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  accent?: boolean;
}) {
  return (
    <Panel className="select-none">
      <PanelLabel>{label}</PanelLabel>
      <p className="mt-1.5 flex items-baseline text-[clamp(2.75rem,9vw,4rem)] leading-[0.95]">
        <ScrubNumber
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          decimals={decimals}
          suffix={suffix}
          label={label}
          tone={accent ? 'accent' : 'inherit'}
        />
      </p>
    </Panel>
  );
}

/**
 * A dial at label size, for the things asked once and then forgotten.
 *
 * Same control as the big ones, smaller, with a second reading underneath —
 * 170 cm is also 5'7", and 1998 is also twenty-eight years old, and having
 * both means never wondering whether the number went in correctly.
 */
function SmallDial({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  step,
  decimals,
  note,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  suffix: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  note: string;
}) {
  return (
    <div className="select-none">
      <PanelLabel>{label}</PanelLabel>
      <p className="mt-1 flex items-baseline text-[1.875rem] leading-none">
        <ScrubNumber
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          decimals={decimals}
          suffix={suffix}
          label={label}
        />
      </p>
      <p className="mt-1.5 text-[0.75rem] text-ink-3">{note}</p>
    </div>
  );
}

/** A row of choices that reads as one control rather than as several buttons. */
function Segment({
  options,
  value,
  onPick,
}: {
  options: Array<{ id: string; label: string; title?: string }>;
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div role="group" className="mt-1.5 flex gap-1 rounded-2xl border border-line bg-surface-2 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onPick(option.id)}
          title={option.title}
          aria-pressed={value === option.id}
          className={cn(
            'relative flex-1 whitespace-nowrap rounded-xl px-2.5 py-2 text-[0.8125rem] transition-colors duration-[var(--t-state)]',
            value === option.id ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {value === option.id ? (
            <motion.span
              layoutId={`segment-${options.map((o) => o.id).join('-')}`}
              transition={{ type: 'spring', stiffness: 520, damping: 42 }}
              className="absolute inset-0 rounded-xl bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
            />
          ) : null}
          <span className="relative">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/** One figure in the readout, draggable once the reader has taken over. */
function PlanFigure({
  label,
  display,
  editable,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  display: string;
  editable: boolean;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <dd className="form-figure text-[1.75rem] leading-none text-ink">
        {editable ? (
          <ScrubNumber
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            step={step}
            decimals={0}
            label={label}
          />
        ) : (
          display
        )}
      </dd>
      <dt className="mt-1.5 text-[0.8125rem] text-ink-3">{label}</dt>
    </div>
  );
}
