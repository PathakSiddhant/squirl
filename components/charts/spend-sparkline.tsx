'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';
import { formatDay, type DayString } from '@/lib/date';
import { formatCompact, formatMoney } from '@/lib/money';

interface DayPoint {
  day: DayString;
  in: number;
  out: number;
  net: number;
  count: number;
}

/**
 * Daily spend over the window.
 *
 * Laid out with flex rather than SVG: a fixed viewBox will not stretch to an
 * arbitrary container width without either distorting the rounded bar ends or
 * leaving the chart floating in the middle of the panel. Bars are thin, share a
 * common baseline, and every column is hoverable across its full height so a
 * two-pixel bar is still an easy target.
 *
 * One series, so no legend: the panel title names it.
 */
export function SpendSparkline({ days }: { days: DayPoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(...days.map((d) => d.out), 1);
  const total = days.reduce((n, d) => n + d.out, 0);
  const spentDays = days.filter((d) => d.out > 0).length;
  const point = active === null ? null : days[active];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="money text-[1.25rem] text-ink">
            {point ? formatMoney(point.out) : formatMoney(total)}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">
            {point
              ? `${formatDay(point.day)}, ${point.count} ${point.count === 1 ? 'entry' : 'entries'}`
              : `across ${spentDays} of ${days.length} days`}
          </p>
        </div>
        <span className="money text-[0.75rem] text-ink-3">peak ₹{formatCompact(max)}</span>
      </div>

      <div
        className="mt-3 flex h-24 items-end gap-px border-b border-line"
        role="img"
        aria-label={`Daily spending for the last ${days.length} days, totalling ${formatMoney(total)}`}
        onMouseLeave={() => setActive(null)}
      >
        {days.map((day, i) => {
          const isActive = active === i;
          // A day with nothing spent still gets a 2px tick, so the baseline
          // reads as a continuous timeline rather than a gap in the data.
          const height = day.out === 0 ? 2 : Math.max(3, (day.out / max) * 96);

          return (
            <button
              key={day.day}
              type="button"
              tabIndex={-1}
              aria-hidden
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="flex h-full flex-1 cursor-default items-end"
            >
              <span
                className={cn(
                  'w-full rounded-t-[2px] transition-opacity duration-[var(--t-state)]',
                  day.out === 0 ? 'bg-line' : 'bg-[var(--out)]',
                  active !== null && !isActive ? 'opacity-35' : 'opacity-100',
                )}
                style={{ height: `${height}px` }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
