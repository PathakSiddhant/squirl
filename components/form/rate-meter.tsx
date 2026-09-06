'use client';

import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/cn';

/**
 * Where a plan sits on the spectrum of what a body can actually do.
 *
 * ## Why this is drawn rather than written
 *
 * §7 asks for a reality check, and a sentence alone makes the reader take the
 * app's word for it. A scale with the bands marked out shows the *shape* of
 * the judgement: that there is a wide comfortable region, a narrower ambitious
 * one, and a cliff — and that the plan currently sits here rather than there.
 *
 * Dragging the timeline moves the marker along it in real time, which turns
 * "your goal is too aggressive" from a verdict handed down into something the
 * reader can steer out of by feel. That is the difference between being told
 * off and being given an instrument.
 *
 * The far band is not red. Being ambitious about your own body is not an
 * error, and colouring it like one would be the app taking a moral position it
 * has no business taking.
 */

const BANDS = [
  { upTo: 0.0075, label: 'comfortable', colour: 'var(--form-met)' },
  { upTo: 0.01, label: 'ambitious', colour: 'var(--app-accent)' },
  { upTo: 0.015, label: 'aggressive', colour: 'var(--form-partial)' },
] as const;

/** The scale runs to two per cent a week, past which nothing sensible lives. */
const CEILING = 0.02;

export function RateMeter({ rate, verdict }: { rate: number; verdict: string }) {
  const reduceMotion = useReducedMotion();
  const at = Math.min(rate / CEILING, 1);

  return (
    <div>
      <div className="relative h-8">
        {/* The bands, laid end to end. */}
        <div className="absolute inset-x-0 top-3 flex h-2 gap-[3px] overflow-hidden rounded-full">
          {BANDS.map((band, index) => {
            const from = index === 0 ? 0 : BANDS[index - 1].upTo;
            return (
              <span
                key={band.label}
                className="h-full rounded-full"
                style={{
                  flexGrow: (band.upTo - from) / CEILING,
                  backgroundColor: band.colour,
                  opacity: 0.32,
                }}
              />
            );
          })}
          <span
            className="h-full rounded-full bg-ink-3"
            style={{ flexGrow: (CEILING - BANDS[BANDS.length - 1].upTo) / CEILING, opacity: 0.18 }}
          />
        </div>

        {/* The needle. Travels as the timeline is dragged. */}
        <motion.div
          className="absolute top-0"
          initial={false}
          animate={{ left: `${at * 100}%` }}
          transition={
            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }
          }
          style={{ translateX: '-50%' }}
        >
          <div className="flex flex-col items-center">
            <span className="form-figure text-[0.75rem] text-ink-2">
              {(rate * 100).toFixed(1)}%
            </span>
            <span className="mt-0.5 h-4 w-[3px] rounded-full bg-ink" />
          </div>
        </motion.div>
      </div>

      <div className="mt-1 flex justify-between text-[0.6875rem] text-ink-3">
        {BANDS.map((band) => (
          <span
            key={band.label}
            className={cn(
              'transition-colors duration-[var(--t-state)]',
              verdict === band.label && 'font-medium text-ink',
            )}
          >
            {band.label}
          </span>
        ))}
        <span className={cn(verdict === 'unrealistic' && 'font-medium text-ink')}>too fast</span>
      </div>
    </div>
  );
}
