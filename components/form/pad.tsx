'use client';

import type { Icon } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/cn';

/**
 * A thing that is either done or not done, as a key you press.
 *
 * ## Why not a switch or a checkbox
 *
 * Creatine and movement are the two facts on Today that take no thought at
 * all, and a control that takes no thought should be *satisfying*, because the
 * only failure mode is not bothering. A checkbox is a form element; this is a
 * key on a machine.
 *
 * Unpressed it stands proud of the panel on a hard offset shadow. Pressed, it
 * travels down and across into its own shadow until the two are flush, and the
 * glyph lights in the flame. Nothing is embossed and nothing is blurred: it is
 * a printed block that moves, which is the language the whole application is
 * drawn in.
 */
export function Pad({
  label,
  note,
  icon: Glyph,
  on,
  onToggle,
  tone = 'var(--app-accent)',
}: {
  label: string;
  note: string;
  icon: Icon;
  on: boolean;
  onToggle: () => void;
  tone?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={cn(
        'group flex min-w-0 items-center gap-3.5 rounded-[1.25rem] border p-3.5 text-left',
        'transition-[background-color,border-color,box-shadow,translate] duration-[var(--t-state)] ease-[var(--ease)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]',
        on
          ? 'translate-x-[3px] translate-y-[3px] border-[var(--form-edge)] bg-[var(--app-accent-wash)] shadow-none'
          : 'border-[var(--form-edge)] bg-surface shadow-[var(--shadow-press)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-panel)]',
      )}
    >
      <span
        className={cn(
          'flex size-11 items-center justify-center rounded-2xl transition-colors duration-[var(--t-state)]',
          on ? 'text-white' : 'bg-surface-3 text-ink-3',
        )}
        style={on ? { background: tone } : undefined}
      >
        <motion.span
          key={on ? 'on' : 'off'}
          initial={reduceMotion ? false : { scale: 0.5, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 22 }}
          className="flex"
        >
          <Glyph size={21} weight={on ? 'fill' : 'regular'} />
        </motion.span>
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[1rem] font-medium text-ink">{label}</span>
        <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-3">{note}</span>
      </span>
    </motion.button>
  );
}
