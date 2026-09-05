'use client';

import { Broadcast } from '@phosphor-icons/react/dist/csr/Broadcast';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/cn';

/**
 * The top of the inbox: how much is waiting, and nothing else.
 *
 * There was a countdown here to the next background check, drawn as a ring that
 * emptied. It went, and it deserved to: a clock ticking in the corner of a page
 * you leave open is three hours of movement in your peripheral vision telling
 * you nothing you were waiting to hear. The sync either found something, in
 * which case the number below changes, or it did not, in which case there was
 * never anything to announce.
 *
 * Everything else Signal could put here — how many things were dismissed last
 * week, how fast the queue is cleared — is a statistic about the reader's own
 * attention, which is exactly the sort of number this product exists to not
 * keep.
 */

export type Lens = 'all' | 'live' | 'soon';

export interface LensCounts {
  all: number;
  live: number;
  soon: number;
}

const LENSES: Array<{ id: Lens; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'live', label: 'Live' },
  { id: 'soon', label: 'Starting soon' },
];

export function QueueHeader({
  waiting,
  live,
  lens,
  counts,
  onLens,
}: {
  waiting: number;
  live: number;
  lens: Lens;
  counts: LensCounts;
  onLens: (next: Lens) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <header className="mb-9">
      <div className="min-w-0">
        {/* The number first and the word after it, because the number is the
              thing you came to find out and the word is only there to say what
              it counts. */}
        <h1 className="flex items-baseline gap-3">
          <Tally value={waiting} />
          <span className="font-serif text-[1.75rem] font-normal tracking-[-0.02em] text-ink">
            {waiting === 1 ? 'thing waiting' : 'things waiting'}
          </span>
        </h1>

        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-ink-3">
          {live > 0 ? (
            <span className="flex items-center gap-1.5 text-[var(--i-owe-text)]">
              <Broadcast size={13} weight="fill" className="animate-pulse" />
              {live} live right now
            </span>
          ) : null}
          {live === 0 ? <span>Nothing live right now. This is the whole list.</span> : null}
        </p>
      </div>

      {/* Only shown when there is genuinely more than one sort of thing in the
          queue. Three tabs over a list of four items is furniture.

          There were length lenses here too — "under 20 minutes", "a proper
          sit-down" — and they were removed because they could not be honest: an
          upcoming stream has no duration until it airs, so a null length read
          as zero minutes and every scheduled broadcast filed itself under the
          shortest bucket. A filter that is wrong about exactly the items you
          are most curious about is worse than no filter. */}
      {counts.live > 0 || counts.soon > 0 ? (
        <div className="mt-7 flex flex-wrap items-center gap-1.5">
          {LENSES.map((entry) => {
            const count = counts[entry.id];
            const empty = count === 0 && entry.id !== 'all';
            const on = lens === entry.id;

            return (
              <button
                key={entry.id}
                type="button"
                disabled={empty}
                onClick={() => onLens(entry.id)}
                aria-pressed={on}
                className={cn(
                  'relative rounded-full px-3.5 py-1.5 text-[0.8125rem] transition-colors duration-[var(--t-state)]',
                  empty && 'cursor-default opacity-30',
                  on ? 'text-ink-invert' : 'text-ink-2 hover:text-ink',
                )}
              >
                {/* The pill slides between lenses instead of appearing on the
                    new one. It is the same object moving, which is what makes
                    the row read as one control rather than five. */}
                {on ? (
                  <motion.span
                    layoutId="signal-lens"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 520, damping: 42 }
                    }
                    className="absolute inset-0 rounded-full bg-ink"
                  />
                ) : null}
                <span className="relative flex items-center gap-1.5">
                  {entry.label}
                  <span
                    className={cn(
                      'signal-meta text-[0.6875rem] tabular-nums',
                      on ? 'opacity-70' : 'opacity-50',
                    )}
                  >
                    {count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </header>
  );
}

/**
 * The count, rolled rather than swapped.
 *
 * Each digit is its own little column that slides, so clearing an item reads as
 * the number going down rather than as the screen redrawing. It is the one
 * flourish on this page and it earns its place: this figure changing is the
 * entire point of every button on the screen below it.
 */
function Tally({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const digits = String(value).split('');

  return (
    <span className="signal-meta flex text-[3.25rem] leading-none tabular-nums text-ink">
      {digits.map((digit, index) => (
        <span key={`${index}-${digits.length}`} className="relative block h-[3.25rem] w-[0.62em] overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={digit}
              initial={reduceMotion ? false : { y: '-100%' }}
              animate={{ y: '0%' }}
              exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
              transition={{ type: 'spring', stiffness: 460, damping: 40 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {digit}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
