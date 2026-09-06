'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

/**
 * A choice between two or four things, as one control.
 *
 * ## Why this replaced a row of buttons
 *
 * The old settings screen put a name on the left of the page and a row of
 * outlined chips on the far right, with a wide gap of nothing between them.
 * Reading it meant finding a word, crossing the page, and remembering what the
 * word was by the time your eye arrived — repeated eight times down the page.
 * It also gave no hint that the options were mutually exclusive, because
 * nothing tied them together.
 *
 * Here the name sits directly above one object, and the options are inside it.
 * Exactly one is filled at a time, so the control states its own rule without
 * anything having to explain it.
 *
 * The fill is a single element moved by the layout engine rather than a class
 * toggled on each option, so choosing is one block sliding across — the same
 * motion the navigation uses, for the same reason.
 */
export function Segment<T extends string>({
  label,
  hint,
  options,
  value,
  onPick,
  className,
}: {
  label: string;
  hint?: string;
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onPick: (id: T) => void;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  // Each instance needs its own layout id, or two controls on one page would
  // fight over a single sliding block and it would fly between them.
  const group = useId();

  return (
    <div className={cn('min-w-0', className)}>
      <span className="form-label">{label}</span>

      <div
        role="group"
        aria-label={label}
        className="mt-1.5 flex gap-1 rounded-[1rem] border border-[var(--form-edge)] bg-surface-2 p-1"
      >
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onPick(option.id)}
              aria-pressed={active}
              className={cn(
                'relative min-w-0 flex-1 whitespace-nowrap rounded-[0.75rem] px-2.5 py-2 text-[0.8125rem]',
                'transition-colors duration-[var(--t-state)]',
                active ? 'text-ink-invert' : 'text-ink-3 hover:text-ink',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]',
              )}
            >
              {active ? (
                <motion.span
                  layoutId={`segment-${group}`}
                  transition={
                    reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }
                  }
                  className="absolute inset-0 rounded-[0.75rem] bg-ink"
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>

      {hint ? <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-3">{hint}</p> : null}
    </div>
  );
}
