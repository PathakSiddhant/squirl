'use client';

import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import type { Position } from '@/lib/domain/position';

/**
 * The five piles, side by side and never merged.
 *
 * This is the correction the product exists for: a normal tracker collapses
 * these into one balance, which is exactly why a balance feels random. Each
 * cell says what it is in plain words, and the row underneath explains the
 * whole idea, because "parked" means nothing to someone seeing it first time.
 */
const CELLS: Array<{
  key: 'inHand' | 'parked' | 'owedToMe' | 'iOwe';
  label: string;
  hint: string;
  tone: string;
  dot: string;
  href: Route;
}> = [
  {
    key: 'inHand',
    label: 'In hand',
    hint: 'You can spend this now',
    tone: 'text-ink',
    dot: 'bg-ink',
    href: '/accounts',
  },
  {
    key: 'parked',
    label: 'Stashed',
    hint: 'Yours, kept out of reach',
    tone: 'text-[var(--parked-text)]',
    dot: 'bg-[var(--parked)]',
    href: '/accounts',
  },
  {
    key: 'owedToMe',
    label: 'Owed to me',
    hint: 'Lent out, coming back',
    tone: 'text-[var(--owed-me-text)]',
    dot: 'bg-[var(--owed-me)]',
    href: '/people',
  },
  {
    key: 'iOwe',
    label: 'I owe',
    hint: 'Has to be paid back',
    tone: 'text-[var(--i-owe-text)]',
    dot: 'bg-[var(--i-owe)]',
    href: '/loans',
  },
];

export function PositionStrip({ position }: { position: Position }) {
  const [open, setOpen] = useState(false);

  return (
    <section aria-label="Where your money is">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-[0.9375rem] font-semibold text-ink">Where your money is</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-[0.8125rem] text-ink-3 transition-colors hover:text-ink"
        >
          What do these mean
          <CaretDown
            size={12}
            className={cn('transition-transform duration-[var(--t-move)]', open && 'rotate-180')}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
        {CELLS.map((cell) => (
          <Link
            key={cell.key}
            href={cell.href}
            className="bg-surface px-3.5 py-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2"
          >
            <div className="flex items-center gap-1.5">
              <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', cell.dot)} />
              <span className="label">{cell.label}</span>
            </div>
            <p className={cn('money mt-1.5 text-[1.0625rem]', cell.tone)}>
              {formatMoney(position[cell.key])}
            </p>
            <p className="mt-0.5 text-[0.75rem] text-ink-3">{cell.hint}</p>
          </Link>
        ))}
      </div>

      {open ? (
        <div className="mt-2 rounded-md border border-line bg-surface px-4 py-3.5">
          <p className="max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-2">
            These four never get added into a single balance, because they behave differently.
            Money you <strong className="font-medium text-ink">stashed</strong> is still yours and
            still counts towards what you are worth, but you deliberately made it hard to reach, so
            it is not spendable. Money you <strong className="font-medium text-ink">lent</strong> is
            also still yours, just not with you right now. Only{' '}
            <strong className="font-medium text-ink">in hand</strong> answers the question "can I
            buy this today".
          </p>
          <Link
            href="/guide"
            className="mt-2 inline-block text-[0.8125rem] font-medium text-ink underline underline-offset-4"
          >
            Read the full guide
          </Link>
        </div>
      ) : null}

      <div className="mt-2 flex items-baseline justify-between gap-3 px-1">
        <span className="text-[0.8125rem] text-ink-3">
          Net worth: everything you own, minus everything you owe
        </span>
        <span className="money text-[0.9375rem] font-medium text-ink">
          {formatMoney(position.netWorth)}
        </span>
      </div>
    </section>
  );
}
