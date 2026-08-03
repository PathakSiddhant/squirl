import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import type { Position } from '@/lib/domain/position';

/**
 * The five positions, side by side and never merged.
 *
 * This is the correction the brief asked for: a normal tracker collapses these
 * into one balance, which is exactly why "sometimes I have 1000, sometimes 0"
 * feels random. Seeing them apart is what makes it stop feeling random.
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
    key: 'inHand' as const,
    label: 'In hand',
    hint: 'Spendable now',
    tone: 'text-ink',
    dot: 'bg-ink',
    href: '/accounts',
  },
  {
    key: 'parked' as const,
    label: 'With parents',
    hint: 'Yours, out of reach',
    tone: 'text-[var(--parked-text)]',
    dot: 'bg-[var(--parked)]',
    href: '/accounts',
  },
  {
    key: 'owedToMe' as const,
    label: 'Owed to me',
    hint: 'Lent out',
    tone: 'text-[var(--owed-me-text)]',
    dot: 'bg-[var(--owed-me)]',
    href: '/people',
  },
  {
    key: 'iOwe' as const,
    label: 'I owe',
    hint: 'People and loans',
    tone: 'text-[var(--i-owe-text)]',
    dot: 'bg-[var(--i-owe)]',
    href: '/loans',
  },
];

export function PositionStrip({ position }: { position: Position }) {
  return (
    <section aria-label="Where your money is">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
        {CELLS.map((cell) => (
          <Link
            key={cell.key}
            href={cell.href}
            className="group bg-surface px-3.5 py-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2"
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

      <div className="mt-2 flex items-baseline justify-between gap-3 px-1">
        <span className="text-[0.8125rem] text-ink-3">
          Net worth, everything added up and everything owed taken off
        </span>
        <span className="money text-[0.9375rem] font-medium text-ink">
          {formatMoney(position.netWorth)}
        </span>
      </div>
    </section>
  );
}
