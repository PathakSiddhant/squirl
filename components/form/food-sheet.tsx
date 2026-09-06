'use client';

import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import { logQuickFood, logSavedFood } from '@/app/actions/form';
import { cn } from '@/lib/cn';
import type { DayString } from '@/lib/date';
import { portion } from '@/lib/form/food';
import { referenceLabel } from '@/lib/form/food';
import type { FoodView } from '@/lib/form/foods';
import { referenceOf } from '@/lib/form/foods';
import { formatEnergy, formatMacro, parseEnergy, parseMacro, parseQuantity } from '@/lib/form/units';

import { FoodPicture } from './food-picture';

/**
 * Logging something eaten.
 *
 * ## Two paths, because there are genuinely two situations
 *
 * Most of what anybody eats is one of the same twenty things, already in the
 * library, and that path has to be three actions long: find it, say how much,
 * done (§30). The rest is a one-off — dinner somewhere, a thing off a menu —
 * and forcing that into a permanent library entry is how a food library fills
 * with things eaten once (§28). So the sheet offers both and defaults to the
 * first.
 *
 * ## The quantity field computes as you type
 *
 * §26 and §88. Typing 68.5 against a per-100g food shows what 68.5 g of it
 * actually is, before anything is saved — the arithmetic happens in front of
 * the reader rather than behind a save button, which is the difference between
 * trusting the number and checking it on a calculator.
 */
export function FoodSheet({
  day,
  foods,
  onClose,
  onDone,
}: {
  day: DayString;
  foods: FoodView[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<FoodView | null>(null);
  const [mode, setMode] = useState<'saved' | 'quick'>('saved');

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return foods.slice(0, 24);
    return foods
      .filter(
        (food) =>
          food.name.toLowerCase().includes(term) ||
          (food.brand ?? '').toLowerCase().includes(term),
      )
      .slice(0, 24);
  }, [foods, query]);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay fixed inset-0 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[scrim-in_180ms_var(--ease)]" />
        <Dialog.Content
          className={cn(
            'form-scope z-modal fixed left-1/2 top-1/2 flex max-h-[86dvh] w-[calc(100vw-1.5rem)] max-w-[32rem] flex-col',
            '-translate-x-1/2 -translate-y-1/2 focus:outline-none',
            'data-[state=open]:animate-[sheet-in_180ms_var(--ease)]',
          )}
        >
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between gap-3 px-5 pt-4">
              <Dialog.Title className="text-[1rem] font-semibold text-ink">
                {picked ? picked.name : 'Add food'}
              </Dialog.Title>
              <Dialog.Close
                aria-label="Close"
                className="-mr-1 flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink"
              >
                <X size={14} />
              </Dialog.Close>
            </div>

            {picked ? (
              <Portioner
                food={picked}
                day={day}
                onBack={() => setPicked(null)}
                onDone={onDone}
              />
            ) : (
              <>
                <div className="mt-3 flex gap-1 px-5">
                  {(['saved', 'quick'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setMode(option)}
                      aria-pressed={mode === option}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-[0.8125rem] transition-colors duration-[var(--t-state)]',
                        mode === option
                          ? 'bg-surface-3 text-ink'
                          : 'text-ink-3 hover:text-ink-2',
                      )}
                    >
                      {option === 'saved' ? 'My foods' : 'One-off'}
                    </button>
                  ))}
                </div>

                {mode === 'saved' ? (
                  <SavedPicker
                    query={query}
                    onQuery={setQuery}
                    matches={matches}
                    total={foods.length}
                    onPick={setPicked}
                  />
                ) : (
                  <QuickForm day={day} onDone={onDone} />
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SavedPicker({
  query,
  onQuery,
  matches,
  total,
  onPick,
}: {
  query: string;
  onQuery: (value: string) => void;
  matches: FoodView[];
  total: number;
  onPick: (food: FoodView) => void;
}) {
  return (
    <>
      <div className="relative mt-3 px-5">
        <MagnifyingGlass
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute left-8 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search your foods"
          autoFocus
          aria-label="Search your foods"
          className="form-field h-10 w-full rounded-xl pl-9 pr-3 text-[0.875rem]"
        />
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-1">
        {matches.length === 0 ? (
          <p className="px-3 py-8 text-center text-[0.875rem] text-ink-3">
            {total === 0 ? (
              <>
                Nothing saved yet.{' '}
                <Link href="/form/food" className="text-ink underline underline-offset-4">
                  Save something you eat often
                </Link>
                , or log a one-off.
              </>
            ) : (
              'Nothing matches that.'
            )}
          </p>
        ) : (
          <ul className="flex flex-col">
            {matches.map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  onClick={() => onPick(food)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-[var(--t-state)] hover:bg-surface-2"
                >
                  <FoodPicture name={food.name} image={food.image} size={36} />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] text-ink">{food.name}</span>
                    <span className="block truncate text-[0.75rem] text-ink-3">
                      {food.brand ? `${food.brand} · ` : ''}
                      {referenceLabel(food.refQuantity, food.refUnit)}
                    </span>
                  </span>
                  <span className="form-figure shrink-0 text-[0.9375rem] text-ink-2">
                    {formatEnergy(food.energyMcal)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/**
 * How much of it.
 *
 * The result updates on every keystroke, computed by the same function the
 * server will use to store it, so what is previewed and what is saved cannot
 * differ.
 */
function Portioner({
  food,
  day,
  onBack,
  onDone,
}: {
  food: FoodView;
  day: DayString;
  onBack: () => void;
  onDone: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [amount, setAmount] = useState(String(food.refQuantity / 1000));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const parsed = parseQuantity(amount, food.refUnit === 'ml' ? 'ml' : 'g');
  const result = parsed ? portion(referenceOf(food), parsed.value) : null;

  const save = () => {
    start(async () => {
      const outcome = await logSavedFood(food.id, amount, day);
      if (outcome.error) {
        setError(outcome.error);
        return;
      }
      onDone();
    });
  };

  const quick = [
    food.refQuantity / 2,
    food.refQuantity,
    food.refQuantity * 1.5,
    food.refQuantity * 2,
  ];

  return (
    <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
      <p className="text-[0.8125rem] text-ink-3">
        {referenceLabel(food.refQuantity, food.refUnit)} · {formatEnergy(food.energyMcal)} kcal ·{' '}
        {formatMacro(food.proteinMg)} g protein
      </p>

      <div>
        <label htmlFor="form-portion" className="form-label">
          How much
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="form-portion"
            value={amount}
            autoFocus
            inputMode="decimal"
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => event.key === 'Enter' && save()}
            className="form-field form-figure h-14 w-full rounded-xl px-3 text-[1.75rem]"
          />
          <span className="shrink-0 text-[1rem] text-ink-3">{food.refUnit}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {quick.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(String(value / 1000))}
              className="rounded-lg border border-line px-2.5 py-1 text-[0.75rem] text-ink-3 transition-colors duration-[var(--t-state)] hover:border-[var(--app-accent)] hover:text-ink"
            >
              {value / 1000}
            </button>
          ))}
        </div>
      </div>

      {/* The arithmetic, in front of the reader rather than behind a button. */}
      <motion.div
        key={result ? result.energyMcal : 'none'}
        initial={reduceMotion ? false : { opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.14 }}
        className="flex items-baseline justify-between gap-4 rounded-xl bg-surface-2 px-4 py-3"
      >
        {result ? (
          <>
            <span className="flex items-baseline gap-1.5">
              <span className="form-figure text-[1.5rem] text-ink">
                {formatEnergy(result.energyMcal)}
              </span>
              <span className="text-[0.8125rem] text-ink-3">kcal</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="form-figure text-[1.25rem] text-ink-2">
                {formatMacro(result.proteinMg, 1)}
              </span>
              <span className="text-[0.8125rem] text-ink-3">g protein</span>
            </span>
          </>
        ) : (
          <span className="text-[0.875rem] text-ink-3">Enter an amount</span>
        )}
      </motion.div>

      {error ? <p className="text-[0.8125rem] text-[var(--i-owe-text)]">{error}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-2 py-2 text-[0.875rem] text-ink-3 transition-colors duration-[var(--t-state)] hover:text-ink"
        >
          Back
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending || !result}
          className="rounded-xl bg-ink px-5 py-2.5 text-[0.875rem] font-medium text-ink-invert transition-opacity duration-[var(--t-state)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add it'}
        </button>
      </div>
    </div>
  );
}

/** Something eaten once, not worth keeping in the library. */
function QuickForm({ day, onDone }: { day: DayString; onDone: () => void }) {
  const [name, setName] = useState('');
  const [energy, setEnergy] = useState('');
  const [protein, setProtein] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const valid = parseEnergy(energy) !== null;

  const save = () => {
    start(async () => {
      const result = await logQuickFood({ name, energy, protein, confidence: 'estimated' }, day);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  };

  const field =
    'form-field h-11 w-full rounded-xl px-3 text-[0.9375rem]';

  return (
    <div className="flex flex-col gap-3 px-5 pb-5 pt-4">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="What was it?"
        autoFocus
        aria-label="What was it"
        className={field}
      />

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="quick-energy" className="form-label">
            Calories
          </label>
          <input
            id="quick-energy"
            value={energy}
            inputMode="decimal"
            onChange={(event) => {
              setEnergy(event.target.value);
              setError(null);
            }}
            placeholder="600"
            className={cn(field, 'mt-1.5')}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="quick-protein" className="form-label">
            Protein
          </label>
          <input
            id="quick-protein"
            value={protein}
            inputMode="decimal"
            onChange={(event) => setProtein(event.target.value)}
            placeholder="optional"
            className={cn(field, 'mt-1.5')}
          />
        </div>
      </div>

      {/* Honest by default: a number somebody eyeballed off a menu is an
          estimate, and the day's total says so rather than pretending. */}
      <p className="text-[0.75rem] text-ink-3">
        Saved as an estimate, so the day’s total stays honest about it.
      </p>

      {error ? <p className="text-[0.8125rem] text-[var(--i-owe-text)]">{error}</p> : null}

      <button
        type="button"
        onClick={save}
        disabled={pending || !valid}
        className="mt-1 self-end rounded-xl bg-ink px-5 py-2.5 text-[0.875rem] font-medium text-ink-invert transition-opacity duration-[var(--t-state)] hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add it'}
      </button>
    </div>
  );
}
