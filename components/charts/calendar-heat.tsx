import { cn } from '@/lib/cn';
import { addDays, eachDay, formatDay, weekdayIndex, type DayString } from '@/lib/date';
import { formatMoney } from '@/lib/money';

/**
 * Twelve weeks of daily spend as a calendar grid.
 *
 * Sequential data, so one hue at four steps of increasing darkness rather than
 * a rainbow. Days with nothing logged are drawn as an outline rather than the
 * lightest step, so "spent nothing" and "forgot to log" are visibly different.
 */
export function CalendarHeat({
  days,
  today,
}: {
  days: Map<DayString, { out: number; count: number }>;
  today: DayString;
}) {
  const start = addDays(today, -83);
  const all = eachDay(start, today);

  // Pad so the first column starts on a Monday.
  const leading = weekdayIndex(start);
  const cells: Array<DayString | null> = [...Array<null>(leading).fill(null), ...all];

  const amounts = all.map((d) => days.get(d)?.out ?? 0).filter((n) => n > 0);
  const sorted = [...amounts].sort((a, b) => a - b);
  const quartile = (q: number) => sorted[Math.floor(sorted.length * q)] ?? 0;
  const steps = [quartile(0.25), quartile(0.5), quartile(0.75)];

  const level = (amount: number, logged: boolean): string => {
    if (!logged) return 'border border-line bg-transparent';
    if (amount === 0) return 'bg-surface-2';
    if (amount <= steps[0]) return 'bg-[var(--out)]/25';
    if (amount <= steps[1]) return 'bg-[var(--out)]/45';
    if (amount <= steps[2]) return 'bg-[var(--out)]/70';
    return 'bg-[var(--out)]';
  };

  return (
    <div className="px-4 pb-4">
      <div className="scroll-x">
        <div
          className="grid grid-flow-col gap-1"
          style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }}
          role="img"
          aria-label="Daily spending over the last twelve weeks"
        >
          {cells.map((day, i) => {
            if (!day) return <span key={`pad-${i}`} className="size-3" />;
            const entry = days.get(day);
            const amount = entry?.out ?? 0;
            const logged = entry !== undefined;

            return (
              <span
                key={day}
                title={`${formatDay(day, today)}: ${logged ? formatMoney(amount) : 'nothing logged'}`}
                className={cn('size-3 rounded-[3px]', level(amount, logged))}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[0.6875rem] text-ink-3">
        <span className="flex items-center gap-1">
          <span className="size-3 rounded-[3px] border border-line" />
          not logged
        </span>
        <span className="flex items-center gap-1">
          less
          <span className="size-3 rounded-[3px] bg-[var(--out)]/25" />
          <span className="size-3 rounded-[3px] bg-[var(--out)]/45" />
          <span className="size-3 rounded-[3px] bg-[var(--out)]/70" />
          <span className="size-3 rounded-[3px] bg-[var(--out)]" />
          more
        </span>
      </div>
    </div>
  );
}
