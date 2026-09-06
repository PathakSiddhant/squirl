'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';
import { formatDayLong, weekdayIndex, type DayString } from '@/lib/date';
import type { DaySummary } from '@/lib/form/log';

/**
 * Days, as a field of squares.
 *
 * The shape is borrowed from a contribution graph and the meaning is not. This
 * does not measure whether the app was opened; it measures how much of what a
 * day asked for actually happened, judged against the targets that were in
 * force on that day (§37).
 *
 * ## One colour, and no failure state
 *
 * The single most important decision here: there is exactly one hue, and a
 * square's intensity is the proportion of that day's targets that were met.
 * Nothing is ever red, because a red square would be the product telling
 * somebody that a Tuesday they ate dinner with friends was a failure — and
 * §35 and §39 are explicit that it was not. A quiet day is simply a quiet
 * square, and the eye reads the field as a texture rather than as a report
 * card.
 *
 * Untracked days are neutral rather than empty for the same reason: "I did not
 * write anything down" is a different statement from "I missed everything",
 * and the graph has to be able to say the first one without implying the
 * second.
 */

export function CompletionGraph({
  days,
  today,
  weeks = 26,
}: {
  days: DaySummary[];
  today: DayString;
  weeks?: number;
}) {
  const [hovered, setHovered] = useState<DaySummary | null>(null);

  // Laid out in columns of seven, Monday at the top, the way a calendar reads.
  const columns: Array<Array<DaySummary | null>> = [];
  let column: Array<DaySummary | null> = [];

  if (days.length > 0) {
    const lead = weekdayIndex(days[0].day);
    for (let i = 0; i < lead; i += 1) column.push(null);
  }

  for (const day of days) {
    column.push(day);
    if (column.length === 7) {
      columns.push(column);
      column = [];
    }
  }
  if (column.length > 0) {
    while (column.length < 7) column.push(null);
    columns.push(column);
  }

  const shown = columns.slice(-weeks);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="form-label">Last {shown.length} weeks</span>
        <span className="min-h-[1rem] text-[0.75rem] text-ink-3">
          {hovered ? describe(hovered) : ''}
        </span>
      </div>

      {/*
        A grid rather than a flex row, so the columns have a ceiling.

        Flexed columns simply divided the panel between them, which meant the
        same thirteen weeks drew as 13px squares in a narrow column and as
        90px slabs in a wide one. A day is a small square at any width.
      */}
      <div
        className="mt-3 grid gap-[4px] overflow-x-auto pb-1"
        style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(11px, 20px))` }}
        onMouseLeave={() => setHovered(null)}
      >
        {shown.map((week, index) => (
          <div key={index} className="flex flex-col gap-[4px]">
            {week.map((day, row) =>
              day ? (
                <button
                  key={day.day}
                  type="button"
                  onMouseEnter={() => setHovered(day)}
                  onFocus={() => setHovered(day)}
                  aria-label={describe(day)}
                  className={cn(
                    'aspect-square w-full min-w-[13px] rounded-[4px] transition-[transform,outline-color] duration-[var(--t-state)]',
                    'outline outline-1 -outline-offset-1 hover:scale-125 focus-visible:scale-125 focus:outline-none',
                    day.day === today ? 'outline-ink-3' : 'outline-transparent',
                  )}
                  style={cellStyle(day.verdict)}
                />
              ) : (
                <span key={`${index}-${row}`} className="aspect-square w-full min-w-[13px]" />
              ),
            )}
          </div>
        ))}
      </div>

      {/*
        A legend that names the three readings rather than a gradient bar of
        "less" to "more". The whole point is that these are different kinds of
        day, not different amounts of virtue.
      */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.75rem] text-ink-3">
        <Key style={cellStyle({ fraction: 1 })} label="everything met" />
        <Key style={cellStyle({ fraction: 0.5 })} label="some of it" />
        <Key style={cellStyle({ fraction: null })} label="nothing written down" />
      </div>
    </div>
  );
}

function Key({ style, label }: { style: React.CSSProperties; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-[11px] rounded-[3px] outline outline-1 -outline-offset-1 outline-transparent" style={style} />
      {label}
    </span>
  );
}

/**
 * The square's fill.
 *
 * Intensity rises with the proportion met, from a floor that is still clearly
 * *something* — a day where one target in five landed should not look identical
 * to a day nobody logged, because those are not the same day.
 */
function cellStyle(day: { fraction: number | null }): React.CSSProperties {
  if (day.fraction === null) {
    return { backgroundColor: 'var(--surface-3)' };
  }
  const alpha = 0.22 + day.fraction * 0.78;
  return {
    backgroundColor: `color-mix(in oklch, var(--app-accent) ${Math.round(alpha * 100)}%, transparent)`,
  };
}

function describe(day: DaySummary): string {
  const when = formatDayLong(day.day);
  const { verdict } = day;

  if (verdict.status === 'future') return `${when} · today`;
  if (verdict.status === 'untracked') return `${when} · nothing written down`;
  if (verdict.status === 'complete') return `${when} · everything met`;

  const unknown = verdict.untracked > 0 ? `, ${verdict.untracked} unknown` : '';
  return `${when} · ${verdict.met} of ${verdict.judged} met${unknown}`;
}
