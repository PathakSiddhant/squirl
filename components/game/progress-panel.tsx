'use client';

import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { Flame } from '@phosphor-icons/react/dist/csr/Flame';
import Link from 'next/link';
import { useState } from 'react';

import { Mark } from '@/components/brand/logo';
import { Icon } from '@/components/shell/icon';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import type { EarnedAchievement, MascotMood } from '@/lib/domain/achievements';

/**
 * The gamified layer, kept deliberately quiet.
 *
 * Three things only: how the squirrel is doing, how long the streak is, and
 * the single nearest milestone. No XP, no levels, no confetti. Progress is
 * shown because it is genuinely informative, not to manufacture a habit loop.
 */
export function ProgressPanel({
  mood,
  streak,
  bestStreak,
  parked,
  earned,
  total,
  next,
}: {
  mood: { mood: MascotMood; title: string; body: string };
  streak: number;
  bestStreak: number;
  parked: number;
  earned: number;
  total: number;
  next: EarnedAchievement | null;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="flex items-start gap-3 px-4 py-4">
        <div
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-md',
            mood.mood === 'stretched' || mood.mood === 'lean'
              ? 'bg-[var(--i-owe-wash)]'
              : 'bg-[var(--acorn-wash)]',
          )}
        >
          <Mark size={34} className={mood.mood === 'new' ? 'opacity-45' : undefined} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-semibold text-ink">{mood.title}</p>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-2">{mood.body}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-t border-line bg-line">
        <Stat
          label="Streak"
          value={`${streak}`}
          suffix={streak === 1 ? 'day' : 'days'}
          hint={bestStreak > streak ? `best ${bestStreak}` : streak > 0 ? 'your best yet' : 'start today'}
          icon={<Flame size={12} weight="fill" className={streak > 0 ? 'text-[var(--acorn)]' : 'text-ink-3'} />}
        />
        <Stat label="Stashed" value={formatMoney(parked)} hint="out of reach" />
        <Stat label="Milestones" value={`${earned}`} suffix={`of ${total}`} hint="earned" />
      </div>

      {next ? (
        <Link
          href="/progress"
          className="flex items-center gap-3 border-t border-line px-4 py-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-ink-3">
            <Icon name={next.icon} size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.8125rem] text-ink">Next: {next.name}</span>
            <span className="block truncate text-[0.75rem] text-ink-3">
              {next.progressLabel ?? next.goalCopy}
            </span>
          </span>
          <span className="flex w-16 shrink-0 items-center gap-2">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
              <span
                className="block h-full rounded-full bg-[var(--acorn)]"
                style={{ width: `${Math.round(next.progress * 100)}%` }}
              />
            </span>
          </span>
          <CaretRight size={13} className="shrink-0 text-ink-3" />
        </Link>
      ) : (
        <Link
          href="/progress"
          className="flex items-center justify-between border-t border-line px-4 py-3 text-[0.8125rem] text-ink-2 transition-colors hover:bg-surface-2"
        >
          Every milestone earned. Have a look.
          <CaretRight size={13} className="text-ink-3" />
        </Link>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
  hint,
  icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <span className="label flex items-center gap-1">
        {icon}
        {label}
      </span>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="money text-[1rem] text-ink">{value}</span>
        {suffix ? <span className="text-[0.6875rem] text-ink-3">{suffix}</span> : null}
      </p>
      {hint ? <p className="text-[0.6875rem] text-ink-3">{hint}</p> : null}
    </div>
  );
}

/** The full milestone grid, used on the progress page. */
export function MilestoneGrid({ achievements }: { achievements: EarnedAchievement[] }) {
  const [filter, setFilter] = useState<'all' | 'earned' | 'todo'>('all');

  const shown = achievements.filter((a) =>
    filter === 'all' ? true : filter === 'earned' ? a.earned : !a.earned,
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        {(
          [
            ['all', 'All'],
            ['earned', 'Earned'],
            ['todo', 'To go'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-sm px-2.5 py-1 text-[0.8125rem] transition-colors duration-[var(--t-state)]',
              filter === value ? 'bg-surface-3 font-medium text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item) => (
          <div
            key={item.id}
            className={cn(
              'rounded-md border p-3.5 transition-colors',
              item.earned ? 'border-line bg-surface' : 'border-dashed border-line bg-transparent',
            )}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-sm',
                  item.earned ? 'bg-[var(--acorn-wash)] text-[var(--acorn-deep)]' : 'bg-surface-2 text-ink-3',
                )}
              >
                <Icon name={item.icon} size={15} weight={item.earned ? 'fill' : 'regular'} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-[0.875rem] font-medium',
                    item.earned ? 'text-ink' : 'text-ink-2',
                  )}
                >
                  {item.name}
                </p>
                <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-3">
                  {item.earned ? item.earnedCopy : item.goalCopy}
                </p>
              </div>
            </div>

            {!item.earned ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-[var(--acorn)]"
                    style={{ width: `${Math.round(item.progress * 100)}%` }}
                  />
                </span>
                {item.progressLabel ? (
                  <span className="shrink-0 text-[0.6875rem] text-ink-3">{item.progressLabel}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
