'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, useTransition } from 'react';

import { cn } from '@/lib/cn';

/**
 * Water, drawn as water.
 *
 * ## Why this is not a fourth ring
 *
 * Six identical rings in a grid is a fitness dashboard, and a fitness
 * dashboard is the one thing this application is not allowed to be. Every
 * quantity on Today gets the instrument its own physics suggests: fuel is an
 * arc because it is spent against a ceiling, protein is a tally because it is
 * accumulated in servings, and water is a vessel because water is a thing you
 * fill something with.
 *
 * The consequence is that the screen is legible before it is read. You cannot
 * mistake the vessel for the fuel arc at a glance the way you can mistake the
 * second ring for the third, and shape is a far faster channel than a label.
 *
 * ## The surface moves
 *
 * Two sine waves at different speeds and opposite directions, which is the
 * cheapest convincing water there is — one wave reads as a wobbling line, two
 * out of phase read as a surface. Both stop dead under `prefers-reduced-motion`
 * rather than slowing down, because a slow wave is worse than none.
 *
 * ## The figure is also a correction
 *
 * "Exact" beside the vessel *adds* — it exists for "382 ml more", the same
 * thing +250 and +500 mean. But a day is sometimes logged wrong outright (a
 * slipped digit, a duplicate tap before this component's own double-submit
 * bug — see `inline-input.tsx` — was fixed), and there was no way to say "no,
 * the whole day's total is actually X" without knowing the day's running
 * total by heart and doing the subtraction by hand. Clicking the figure
 * itself opens the same kind of field, but `onSetTotal` *replaces* rather
 * than adds — the one control on this screen that overrides instead of
 * accumulating, which is exactly why it lives on the number being corrected
 * rather than beside it.
 */
export function Vessel({
  fraction,
  reading,
  goal,
  height = 168,
  width = 104,
  onSetTotal,
}: {
  /** 0 to 1. Values over 1 are clamped for drawing; the figure still tells the truth. */
  fraction: number;
  reading: string;
  goal?: string;
  height?: number;
  width?: number;
  /** Present only on the instance that lets the day's whole total be corrected. */
  onSetTotal?: (raw: string) => Promise<{ error: string | null }>;
}) {
  const reduceMotion = useReducedMotion();
  const filled = Math.min(Math.max(fraction, 0), 1);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, start] = useTransition();
  const field = useRef<HTMLInputElement>(null);
  // Same re-entrancy guard as InlineInput, and for the same reason: Enter
  // closes the field, and unmounting a focused input fires a trailing blur.
  const committing = useRef(false);

  useEffect(() => {
    if (editing) field.current?.select();
  }, [editing]);

  const commit = () => {
    if (committing.current || !onSetTotal) return;
    const raw = draft.trim();
    if (!raw) {
      setEditing(false);
      return;
    }
    committing.current = true;
    start(async () => {
      await onSetTotal(raw);
      setEditing(false);
    });
  };

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[1rem] border-2 border-[var(--form-edge)] bg-surface"
      style={{ width, height }}
    >
      {/*
        The body of water. Height is the reading; nothing else encodes it.

        An empty vessel draws nothing at all — the surface overhangs the fill by
        its own height, so at zero the waves floated at the bottom of the glass
        as a stray blue smear with no water under it.
      */}
      <motion.div
        className="absolute inset-x-0 bottom-0"
        initial={reduceMotion ? false : { height: 0 }}
        animate={{ height: `${filled * 100}%` }}
        transition={
          reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }
        }
        aria-hidden="true"
        hidden={filled <= 0}
      >
        <div className="absolute inset-0 bg-[var(--form-water)] opacity-[0.22]" />

        {/* The surface. Sits above the fill and overhangs it by its own height. */}
        <div className="absolute inset-x-0 -top-[10px] h-[12px] overflow-hidden">
          <svg
            className={cn('absolute left-0 h-full w-[200%]', !reduceMotion && 'form-wave')}
            viewBox="0 0 200 12"
            preserveAspectRatio="none"
          >
            <path
              d="M0 6 C 12 0, 38 0, 50 6 S 88 12, 100 6 S 138 0, 150 6 S 188 12, 200 6 V 12 H 0 Z"
              fill="var(--form-water)"
              opacity="0.28"
            />
          </svg>
          <svg
            className={cn('absolute left-0 h-full w-[200%]', !reduceMotion && 'form-wave-slow')}
            viewBox="0 0 200 12"
            preserveAspectRatio="none"
          >
            <path
              d="M0 7 C 14 2, 36 2, 50 7 S 86 12, 100 7 S 136 2, 150 7 S 186 12, 200 7 V 12 H 0 Z"
              fill="var(--form-water)"
              opacity="0.2"
            />
          </svg>
        </div>
      </motion.div>

      {/*
        Graduations, like a measuring jug.

        An empty vessel is otherwise just a rounded rectangle, and a rounded
        rectangle is a card. Four marks up the left wall are the difference
        between an empty glass and an empty box.
      */}
      <div className="pointer-events-none absolute inset-y-5 left-0 flex flex-col justify-between" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="block h-px rounded-full bg-line-strong opacity-70"
            style={{ width: i % 2 === 0 ? 13 : 8 }}
          />
        ))}
      </div>

      {/* The figure floats over the water rather than sitting beside it. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        {editing ? (
          <input
            ref={field}
            value={draft}
            autoFocus
            inputMode="decimal"
            aria-label="Correct the day's water total"
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setEditing(false);
              }
            }}
            className="form-figure w-[5.5ch] rounded-lg border border-[var(--form-edge)] bg-surface px-1 text-center text-[1.75rem] leading-none text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={
              onSetTotal
                ? () => {
                    committing.current = false;
                    setDraft('');
                    setEditing(true);
                  }
                : undefined
            }
            aria-label={onSetTotal ? "Correct the day's water total" : undefined}
            className={cn(
              'form-figure rounded-lg text-[1.75rem] leading-none text-ink',
              onSetTotal && 'transition-opacity duration-[var(--t-state)] hover:opacity-60',
            )}
          >
            {reading}
          </button>
        )}
        {goal ? <span className="mt-1.5 text-[0.6875rem] text-ink-3">of {goal}</span> : null}
      </div>
    </div>
  );
}
