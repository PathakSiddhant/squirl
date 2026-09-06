'use client';

import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { MagicWand } from '@phosphor-icons/react/dist/csr/MagicWand';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple';
import { X } from '@phosphor-icons/react/dist/csr/X';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';

import {
  copyFood,
  editFood,
  fetchFoodImage,
  lookUpImage,
  removeFood,
  saveFood,
  setFoodImage,
  type FoodFormInput,
} from '@/app/actions/form';
import { cn } from '@/lib/cn';
import { referenceLabel } from '@/lib/form/food';
import type { FoodView } from '@/lib/form/foods';
import { formatEnergy, formatMacro } from '@/lib/form/units';
import { FOOD_UNITS, type FoodUnit } from '@/lib/form/schema';

import { FoodPicture } from './food-picture';

/**
 * The personal food library.
 *
 * Twenty or thirty things, entered once with the packet in hand and then
 * reused for years. That is the whole scope (§93): there is no public database
 * behind this, no barcodes, and nothing to sync.
 *
 * Laid out as a list of lines rather than a grid of cards, because the useful
 * comparison here is vertical — running an eye down a column of calorie
 * figures to find the one you meant — and cards make that impossible while
 * taking four times the room.
 */
export function FoodLibrary({ foods }: { foods: FoodView[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<FoodView | null>(null);
  const [creating, setCreating] = useState(false);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return foods;
    return foods.filter(
      (food) =>
        food.name.toLowerCase().includes(term) || (food.brand ?? '').toLowerCase().includes(term),
    );
  }, [foods, query]);

  const run = (action: () => Promise<unknown>) =>
    start(async () => {
      await action();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <section className="form-panel rounded-[1.75rem] p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[2rem] leading-none tracking-[-0.03em] text-ink">
              Your kitchen
            </h1>
            <p className="mt-2.5 max-w-[34rem] text-[0.9375rem] leading-relaxed text-ink-2">
              Everything is stored per reference amount, so logging 68.5 g of something is
              arithmetic Form does rather than arithmetic you do.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--app-accent)] px-4 py-2.5 text-[0.875rem] font-medium text-white transition-[translate,box-shadow] duration-[var(--t-state)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
          >
            <Plus size={13} weight="bold" />
            Add a food
          </button>
        </div>

        {foods.length > 0 ? (
          <div className="relative mt-6 max-w-[24rem]">
            <MagnifyingGlass
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search your foods"
              className="form-field h-11 w-full rounded-full pl-9 pr-3 text-[0.875rem]"
            />
          </div>
        ) : null}
      </section>

      <section>
      {foods.length === 0 ? (
        <div className="form-panel rounded-[1.75rem] px-6 py-16 text-center">
          <p className="font-serif text-[1.25rem] tracking-[-0.02em] text-ink">
            Nothing saved yet.
          </p>
          <p className="mx-auto mt-2 max-w-[26rem] text-[0.875rem] leading-relaxed text-ink-3">
            Add the one thing you eat every morning. Entered once, reused for years — and Form
            goes and finds a picture of it for you.
          </p>
        </div>
      ) : matches.length === 0 ? (
        <p className="form-panel rounded-[1.75rem] px-6 py-12 text-center text-[0.9375rem] text-ink-3">
          Nothing matches that.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence initial={false}>
            {matches.map((food, index) => (
              <motion.li
                key={food.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{
                  type: 'spring',
                  stiffness: 420,
                  damping: 34,
                  delay: Math.min(index * 0.02, 0.2),
                }}
                className={cn(
                  'group/row relative rounded-[1.25rem] border border-[var(--form-edge)] bg-surface p-3.5',
                  'shadow-[var(--shadow-press)] transition-[translate,box-shadow] duration-[var(--t-hover)] ease-[var(--ease-spring)]',
                  'hover:-translate-y-1 hover:shadow-[var(--shadow-pop)]',
                )}
              >
                <button
                  type="button"
                  onClick={() => setEditing(food)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <FoodPicture name={food.name} image={food.image} size={56} />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium text-ink">
                      {food.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.75rem] text-ink-3">
                      {food.brand ? `${food.brand} · ` : ''}
                      {referenceLabel(food.refQuantity, food.refUnit)}
                    </span>
                    {/*
                      The unit has to leave the figure's typeface.

                      `form-figure` is a display serif with tight tracking, and
                      a nested span inherits it — so "kcal" was being set in a
                      condensed serif at eleven pixels and was genuinely
                      unreadable. Units are sans, at a size a unit can be read
                      at, and never smaller than the caption beside them.
                    */}
                    <span className="mt-2 flex items-baseline gap-4">
                      <span className="form-figure text-[1.375rem] text-ink">
                        {formatEnergy(food.energyMcal)}
                        <span className="ml-1.5 font-sans text-[0.8125rem] tracking-normal text-ink-3">
                          kcal
                        </span>
                      </span>
                      <span className="form-figure text-[1.375rem] text-ink-2">
                        {formatMacro(food.proteinMg)}
                        <span className="ml-1.5 font-sans text-[0.8125rem] tracking-normal text-ink-3">
                          g protein
                        </span>
                      </span>
                    </span>
                  </span>
                </button>

                <span className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity duration-[var(--t-state)] focus-within:opacity-100 group-hover/row:opacity-100">
                  <button
                    type="button"
                    onClick={() => run(() => copyFood(food.id))}
                    aria-label={`Duplicate ${food.name}`}
                    className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-3 hover:text-ink"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => removeFood(food.id))}
                    aria-label={`Delete ${food.name}`}
                    className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-[var(--i-owe-wash)] hover:text-[var(--i-owe-text)]"
                  >
                    <Trash size={12} />
                  </button>
                </span>

                {food.useCount > 0 ? (
                  <span className="absolute bottom-3.5 right-3.5 text-[0.75rem] text-ink-3">
                    {food.useCount}x
                  </span>
                ) : null}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* Deleting a food never touches the days that used it: those rows carry
          their own name and their own numbers. Worth saying once, here. */}
      {foods.length > 0 ? (
        <p className="px-1 pb-1 pt-4 text-[0.75rem] text-ink-3">
          Editing or deleting a food leaves every day you already logged exactly as it was.
        </p>
      ) : null}
      </section>

      {(creating || editing) && (
        <FoodForm
          food={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/**
 * Adding or correcting a food.
 *
 * ## The picture comes first, and it is not decoration
 *
 * A food library is a list of nouns, and a list of nouns is the hardest kind
 * of list to search with your eyes. A photograph turns "find the curd among
 * thirty rows" into recognition rather than reading, which is the difference
 * between this page working at a glance and being a spreadsheet.
 *
 * So the top of this dialog is the picture, and there are three ways to get
 * one: let Form go and find it, choose a file, or leave it and take the icon
 * for whatever kind of thing it is. Finding runs on its own the first time a
 * new food is saved, because nobody should have to ask for the obvious thing.
 *
 * ## Chosen files are re-encoded before they are stored
 *
 * A photograph off a phone is four megabytes and four thousand pixels wide,
 * and putting that in a database row would be indefensible. It is drawn onto a
 * 320px square canvas and re-encoded here, in the browser, so what crosses the
 * wire and what lands in the row is about twenty kilobytes.
 */
function FoodForm({
  food,
  onClose,
  onDone,
}: {
  food: FoodView | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(food?.name ?? '');
  const [brand, setBrand] = useState(food?.brand ?? '');
  const [refQuantity, setRefQuantity] = useState(food ? String(food.refQuantity / 1000) : '100');
  const [refUnit, setRefUnit] = useState<FoodUnit>(food?.refUnit ?? 'g');
  const [energy, setEnergy] = useState(food ? String(Math.round(food.energyMcal / 1000)) : '');
  const [protein, setProtein] = useState(food ? String(food.proteinMg / 1000) : '');
  const [carbs, setCarbs] = useState(food?.carbsMg != null ? String(food.carbsMg / 1000) : '');
  const [fat, setFat] = useState(food?.fatMg != null ? String(food.fatMg / 1000) : '');
  const [fiber, setFiber] = useState(food?.fiberMg != null ? String(food.fiberMg / 1000) : '');

  const [image, setImage] = useState<string | null>(food?.image ?? null);
  const [hunting, setHunting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  const hunt = () => {
    const term = name.trim();
    if (!term) {
      setError('Give it a name first, so Form knows what to look for.');
      return;
    }
    setHunting(true);
    setError(null);
    start(async () => {
      const result = await lookUpImage(term);
      if (result.image) setImage(result.image);
      else setError(result.error ?? 'Nothing turned up. You can choose a file instead.');
      setHunting(false);
    });
  };

  const choose = async (chosen: File | undefined) => {
    if (!chosen) return;
    setError(null);
    try {
      setImage(await squareDataUrl(chosen));
    } catch {
      setError('That file could not be read as an image.');
    }
  };

  const submit = () => {
    setError(null);
    start(async () => {
      const input: FoodFormInput = {
        name,
        brand: brand.trim() || null,
        refQuantity,
        refUnit,
        energy,
        protein,
        carbs,
        fat,
        fiber,
      };

      const result = food ? await editFood(food.id, input) : await saveFood(input);
      if (result.error) {
        setError(result.error);
        return;
      }

      const foodId = food?.id ?? (result as { id?: string }).id;
      if (foodId) {
        if (image !== (food?.image ?? null)) {
          await setFoodImage(foodId, image);
        } else if (!food && !image) {
          // A brand-new food with no picture gets one looked up in the
          // background. It is the obvious thing, so nobody should have to ask.
          await fetchFoodImage(foodId);
        }
      }

      onDone();
    });
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay fixed inset-0 bg-black/40 data-[state=open]:animate-[scrim-in_180ms_var(--ease)]" />
        <Dialog.Content
          className={cn(
            'z-modal fixed left-1/2 top-1/2 max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-[30rem] overflow-y-auto',
            '-translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border border-[var(--form-edge)] bg-surface p-5',
            'shadow-[var(--shadow-pop)] focus:outline-none data-[state=open]:animate-[sheet-in_180ms_var(--ease)]',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="font-serif text-[1.375rem] leading-none tracking-[-0.025em] text-ink">
              {food ? 'Edit food' : 'Add a food'}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="-mr-1 -mt-1 flex size-7 items-center justify-center rounded-full text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink"
            >
              <X size={14} />
            </Dialog.Close>
          </div>

          {/* -------------------------------------------------- the picture */}
          <div className="mt-5 flex items-center gap-4">
            <FoodPicture name={name || 'food'} image={image} size={88} />

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={hunt}
                  disabled={hunting || pending}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--form-edge)] bg-surface px-3 py-1.5 text-[0.8125rem] text-ink transition-[translate,box-shadow] duration-[var(--t-state)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-press)] disabled:opacity-50"
                >
                  <MagicWand size={13} />
                  {hunting ? 'Looking…' : 'Find a picture'}
                </button>

                <button
                  type="button"
                  onClick={() => file.current?.click()}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--form-edge)] bg-surface px-3 py-1.5 text-[0.8125rem] text-ink transition-[translate,box-shadow] duration-[var(--t-state)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-press)]"
                >
                  <UploadSimple size={13} />
                  Choose
                </button>

                {image ? (
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="rounded-full px-2.5 py-1.5 text-[0.8125rem] text-ink-3 transition-colors duration-[var(--t-state)] hover:text-ink"
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <p className="text-[0.75rem] leading-relaxed text-ink-3">
                Found pictures come from Wikipedia and are kept in your own database, so they go on
                working with the network off.
              </p>

              <input
                ref={file}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => void choose(event.target.files?.[0])}
              />
            </div>
          </div>

          {/* -------------------------------------------------- the numbers */}
          <div className="mt-6 flex flex-col gap-4">
            <Field label="Name" value={name} onChange={setName} placeholder="Curd" autoFocus />
            <Field label="Brand" value={brand} onChange={setBrand} placeholder="optional" />

            <div>
              <span className="form-label">These numbers describe</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={refQuantity}
                  onChange={(event) => setRefQuantity(event.target.value)}
                  inputMode="decimal"
                  aria-label="Reference amount"
                  className="form-field h-11 w-24 rounded-xl px-3 text-[0.9375rem]"
                />
                <div className="flex flex-1 gap-1 rounded-xl border border-[var(--form-edge)] p-1">
                  {FOOD_UNITS.map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setRefUnit(unit)}
                      aria-pressed={refUnit === unit}
                      className={cn(
                        'flex-1 rounded-lg px-2 py-1.5 text-[0.8125rem] transition-colors duration-[var(--t-state)]',
                        refUnit === unit ? 'bg-ink text-ink-invert' : 'text-ink-3 hover:text-ink',
                      )}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Calories" value={energy} onChange={setEnergy} placeholder="kcal" />
              <Field label="Protein" value={protein} onChange={setProtein} placeholder="g" />
              <Field label="Carbs" value={carbs} onChange={setCarbs} placeholder="optional" />
              <Field label="Fat" value={fat} onChange={setFat} placeholder="optional" />
              <Field label="Fibre" value={fiber} onChange={setFiber} placeholder="optional" />
            </div>
          </div>

          {error ? <p className="mt-4 text-[0.8125rem] text-[var(--i-owe-text)]">{error}</p> : null}

          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="mt-6 w-full rounded-full bg-[var(--app-accent)] px-4 py-3 text-[0.9375rem] font-medium text-white transition-[translate,box-shadow] duration-[var(--t-state)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] disabled:opacity-60"
          >
            {food ? 'Save changes' : 'Add to my kitchen'}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A labelled field, with its name above the box rather than opposite it. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="form-label">{label}</span>
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="form-field mt-1.5 h-11 w-full rounded-xl px-3 text-[0.9375rem]"
      />
    </label>
  );
}

/**
 * Re-encode a chosen file to a small square.
 *
 * Centre-cropped rather than letterboxed, because every picture in this
 * application is drawn in a square and a photograph with bars down the side
 * looks like a mistake sitting next to one without them.
 */
async function squareDataUrl(file: File, size = 320): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas unavailable');

  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();

  return canvas.toDataURL('image/jpeg', 0.82);
}
