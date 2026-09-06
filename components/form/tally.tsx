'use client';

import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/cn';

/**
 * Protein, counted rather than measured.
 *
 * ## Why blocks
 *
 * Protein is the one target on a cut that is actually reached in lumps: an
 * egg, a bowl of dal, a scoop. Nobody thinks in the 137 grams the log adds up
 * to — they think in "three more things like that one". So it is drawn the way
 * it is lived, as a row of blocks that fill up, each one worth a tenth of the
 * day's target.
 *
 * It also means the reading survives being glanced at from across the kitchen.
 * Counting seven full blocks out of ten is faster than reading `137 / 190`, and
 * it is the same instrument a tally chart has used for four thousand years.
 *
 * The last partial block fills partially rather than rounding, because rounding
 * up would quietly congratulate you for a block you have not eaten.
 */
export function Tally({
  fraction,
  blocks = 10,
  tone = 'var(--form-met)',
  className,
}: {
  fraction: number;
  blocks?: number;
  tone?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const filled = Math.max(fraction, 0);

  return (
    <div className={cn('flex items-end gap-[5px]', className)} aria-hidden="true">
      {Array.from({ length: blocks }, (_, i) => {
        // How much of *this* block is covered: 1 when fully past, a fraction on
        // the one the reading lands inside, 0 beyond it.
        const share = Math.min(Math.max(filled * blocks - i, 0), 1);

        return (
          <span
            key={i}
            className="relative h-12 flex-1 overflow-hidden rounded-[4px] border border-[var(--form-edge)] bg-surface-2"
          >
            <motion.span
              className="absolute inset-x-0 bottom-0 rounded-[5px]"
              style={{ background: tone }}
              initial={reduceMotion ? false : { height: 0 }}
              animate={{ height: `${share * 100}%` }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 300, damping: 26, delay: i * 0.035 }
              }
            />
          </span>
        );
      })}
    </div>
  );
}
