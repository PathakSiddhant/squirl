'use client';

import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { formatDay, formatRelativeDay, type DayString } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import type { Commitment } from '@/lib/domain/position';

/**
 * The number the whole app exists to produce.
 *
 * It is never asserted without its working shown: the breakdown underneath
 * accounts for every rupee between what is in hand and what is safe to spend,
 * because a finance app that says "you can spend 3,263" and refuses to explain
 * why is not trustworthy.
 */
export function SafeToSpend({
  safeToSpend,
  inHand,
  committed,
  buffer,
  shortfall,
  isUnderwater,
  commitments,
  perDay,
  untilDay,
  days,
}: {
  safeToSpend: number;
  inHand: number;
  committed: number;
  buffer: number;
  shortfall: number;
  isUnderwater: boolean;
  commitments: Commitment[];
  perDay: number;
  untilDay: DayString;
  days: number;
}) {
  const [open, setOpen] = useState(false);
  const display = useCountUp(isUnderwater ? shortfall : safeToSpend);

  return (
    <section className="flex flex-col rounded-md border border-line bg-surface">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <h2 className="label">{isUnderwater ? 'Short by' : 'Safe to spend'}</h2>
          {isUnderwater ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--i-owe-wash)] px-1.5 py-0.5 text-[0.6875rem] font-medium text-[var(--i-owe-text)]">
              <Warning size={11} weight="fill" />
              over committed
            </span>
          ) : null}
        </div>

        {/* Rounded to the rupee. Paise on a headline figure is noise, and the
            count-up would otherwise land on a jittering fractional value. */}
        <p
          className={cn('hero-figure mt-2', isUnderwater ? 'text-[var(--i-owe-text)]' : 'text-ink')}
        >
          {formatMoney(display, { paise: false })}
        </p>

        <p className="mt-2 max-w-[52ch] text-[0.875rem] text-ink-2">
          {isUnderwater ? (
            <>
              What you owe inside the next month is more than what you are holding. Getting{' '}
              {formatMoney(shortfall)} in, or pushing a due date, closes the gap.
            </>
          ) : days > 1 ? (
            <>
              That is <span className="money text-ink">{formatMoney(perDay)}</span> a day for the{' '}
              {days} days until {formatDay(untilDay)}.
            </>
          ) : (
            <>Everything already promised has been set aside.</>
          )}
        </p>
      </div>

      {/* mt-auto pins the disclosure to the bottom, so when this panel is
          stretched to match a taller neighbour the slack sits above the rule
          rather than leaving a dead gap under it. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-auto flex w-full items-center justify-between gap-2 border-t border-line px-5 py-2.5 text-left text-[0.8125rem] text-ink-2 transition-colors hover:bg-surface-2"
      >
        <span>How this number is built</span>
        <CaretDown
          size={13}
          className={cn('transition-transform duration-[var(--t-move)]', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div className="border-t border-line px-5 py-3">
          <dl className="space-y-1.5 text-[0.8125rem]">
            <Row label="In hand right now" value={inHand} />
            <Row label="Promised inside 30 days" value={-committed} />
            {buffer > 0 ? <Row label="Buffer you keep untouched" value={-buffer} /> : null}
            <div className="!mt-2.5 flex items-center justify-between border-t border-line pt-2.5 font-medium">
              <dt className="text-ink">{isUnderwater ? 'Short by' : 'Safe to spend'}</dt>
              <dd className="money text-ink">{formatMoney(isUnderwater ? -shortfall : safeToSpend)}</dd>
            </div>
          </dl>

          {commitments.length > 0 ? (
            <div className="mt-4">
              <p className="label mb-2">What is promised</p>
              <ul className="space-y-1.5">
                {commitments.map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="min-w-0 truncate text-ink-2">
                      {c.label}
                      <span className={cn('ml-1.5', c.isOverdue ? 'text-[var(--i-owe-text)]' : 'text-ink-3')}>
                        {c.isOverdue ? 'overdue' : formatRelativeDay(c.dueOn)}
                      </span>
                    </span>
                    <span className="money shrink-0 text-ink-2">{formatMoney(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-2">{label}</dt>
      <dd className={cn('money', value < 0 ? 'text-ink-3' : 'text-ink-2')}>
        {value < 0 ? `− ${formatMoney(-value)}` : formatMoney(value)}
      </dd>
    </div>
  );
}

/**
 * Counts to the value so a change is impossible to miss.
 * Honours reduced motion by landing on the number immediately.
 */
function useCountUp(target: number): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      return;
    }
    let frame = 0;
    const from = 0;
    const duration = 520;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduceMotion]);

  return value;
}
