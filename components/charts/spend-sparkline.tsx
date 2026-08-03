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
 * One series, so no legend: the panel title names it. Bars are thin with
 * rounded data-ends anchored to the baseline, separated by a surface gap, and
 * every bar is hoverable with a hit target wider than the mark itself.
 */
export function SpendSparkline({ days }: { days: DayPoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(...days.map((d) => d.out), 1);
  const total = days.reduce((n, d) => n + d.out, 0);
  const spentDays = days.filter((d) => d.out > 0).length;
  const point = active === null ? null : days[active];

  const height = 96;
  const gap = 2;
  const width = 320;
  const slot = width / days.length;
  const barWidth = Math.max(2, slot - gap);

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

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 w-full"
        style={{ height }}
        role="img"
        aria-label={`Daily spending for the last ${days.length} days, totalling ${formatMoney(total)}`}
        onMouseLeave={() => setActive(null)}
      >
        {/* A single recessive baseline. No gridlines: the values are read from
            the tooltip, and lines would only add ink. */}
        <line
          x1={0}
          y1={height - 0.5}
          x2={width}
          y2={height - 0.5}
          stroke="var(--line)"
          strokeWidth={1}
        />

        {days.map((day, i) => {
          const barHeight = day.out === 0 ? 0 : Math.max(2, (day.out / max) * (height - 8));
          const x = i * slot;
          const isActive = active === i;

          return (
            <g key={day.day}>
              {barHeight > 0 ? (
                <rect
                  x={x}
                  y={height - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={Math.min(2, barWidth / 2)}
                  className={cn(
                    'transition-opacity duration-[var(--t-state)]',
                    active !== null && !isActive ? 'opacity-35' : 'opacity-100',
                  )}
                  fill="var(--out)"
                />
              ) : (
                <rect x={x} y={height - 2} width={barWidth} height={2} rx={1} fill="var(--line)" />
              )}

              {/* Hit target spans the full column height so a 2px bar is still
                  easy to hover on a trackpad. */}
              <rect
                x={x - gap / 2}
                y={0}
                width={slot}
                height={height}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
