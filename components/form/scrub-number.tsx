'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * A number you drag.
 *
 * ## Why not an input
 *
 * A weight goal is not typed once and forgotten — it is *tried*. Somebody sets
 * 68, sees what that does to the calorie figure, tries 70, tries 72. A text
 * field makes each of those a select-all-and-retype; dragging makes it a
 * gesture, and the numbers underneath move while your finger is still down.
 * That is the difference between filling in a form and operating something.
 *
 * Still typeable. Click it and it becomes a field, because dragging from 72 to
 * 105 is silly and everybody knows their own weight. Drag for exploring, type
 * for stating — the control supports the two things people actually do rather
 * than picking one and making the other awkward.
 *
 * Pointer capture means the drag survives leaving the element, which is what
 * stops the value sticking when a fast drag outruns the cursor.
 */
export function ScrubNumber({
  value,
  onChange,
  step = 0.1,
  min = 0,
  max = 999,
  decimals = 1,
  suffix,
  label,
  tone = 'inherit',
}: {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  suffix?: string;
  label: string;
  tone?: 'inherit' | 'accent';
}) {
  const [dragging, setDragging] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const anchor = useRef({ x: 0, value: 0 });
  const field = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (typing) field.current?.select();
  }, [typing]);

  const clamp = (next: number) => Math.min(Math.max(next, min), max);

  const commit = () => {
    const parsed = Number(draft.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(parsed)) onChange(clamp(Number(parsed.toFixed(decimals))));
    setTyping(false);
  };

  if (typing) {
    return (
      <input
        ref={field}
        value={draft}
        inputMode="decimal"
        aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setTyping(false);
        }}
        className={cn(
          'form-figure w-[4.5ch] rounded-xl border-2 border-[var(--app-accent)] bg-transparent',
          'px-1 text-[inherit] outline-none',
          tone === 'accent' ? 'text-[var(--app-accent)]' : 'text-current',
        )}
      />
    );
  }

  return (
    <motion.button
      type="button"
      aria-label={`${label}. Drag to change, or click to type.`}
      animate={dragging && !reduceMotion ? { scale: 1.04 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        anchor.current = { x: event.clientX, value };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!dragging) return;
        // Roughly one step per four pixels: fast enough to cross a sensible
        // range in one gesture, slow enough to land on a specific number.
        const moved = Math.round((event.clientX - anchor.current.x) / 4) * step;
        const next = clamp(Number((anchor.current.value + moved).toFixed(decimals)));
        if (next !== value) onChange(next);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(false);
      }}
      onPointerCancel={() => setDragging(false)}
      onClick={() => {
        // A click that did not move is a request to type.
        if (!dragging) {
          setDraft(value.toFixed(decimals));
          setTyping(true);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
          event.preventDefault();
          onChange(clamp(Number((value + step).toFixed(decimals))));
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
          event.preventDefault();
          onChange(clamp(Number((value - step).toFixed(decimals))));
        }
        if (event.key === 'Enter') {
          setDraft(value.toFixed(decimals));
          setTyping(true);
        }
      }}
      className={cn(
        'form-figure relative cursor-ew-resize touch-none select-none rounded-xl px-1',
        'transition-colors duration-[var(--t-state)]',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--app-accent)]',
        tone === 'accent' ? 'text-[var(--app-accent)]' : 'text-current',
      )}
    >
      {value.toFixed(decimals)}
      {suffix ? <span className="ml-1 text-[0.42em] font-normal opacity-55">{suffix}</span> : null}

      {/* The grab rail. Only there while the pointer is on it, so a page of
          these is not a page of underlines. */}
      <span
        className={cn(
          'absolute inset-x-1 -bottom-0.5 h-[3px] rounded-full transition-opacity duration-[var(--t-state)]',
          dragging ? 'bg-[var(--app-accent)] opacity-100' : 'bg-line-strong opacity-0',
        )}
        aria-hidden="true"
      />
    </motion.button>
  );
}
