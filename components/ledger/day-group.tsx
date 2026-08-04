import { cn } from '@/lib/cn';
import { formatDayLong, formatRelativeDay, type DayString } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import type { LedgerEntry } from '@/lib/queries/ledger';

import { EntryList } from './entry-list';
import type { EditorContext } from './entry-editor';

/**
 * A day, with everything that happened on it.
 *
 * The day is the unit of the whole app, so it gets a real header carrying its
 * own totals rather than being a divider between rows.
 */
export function DayGroup({
  day,
  entries,
  today,
  context,
}: {
  day: DayString;
  entries: LedgerEntry[];
  today: DayString;
  context: EditorContext;
}) {
  let moneyIn = 0;
  let moneyOut = 0;

  for (const entry of entries) {
    // Transfers move money between your own accounts, so they belong in the
    // list but must not inflate either total.
    if (entry.kind === 'transfer') continue;
    const inbound = ['income', 'borrow', 'collect', 'loan_taken', 'adjust_up'].includes(entry.kind);
    if (inbound) moneyIn += entry.amount;
    else moneyOut += entry.amount;
  }

  const relative = formatRelativeDay(day, today);
  const isToday = day === today;

  return (
    <section className="overflow-hidden rounded-md border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <h2 className={cn('text-[0.875rem] font-medium', isToday ? 'text-ink' : 'text-ink-2')}>
            {formatDayLong(day, today)}
          </h2>
          {relative !== formatDayLong(day, today) ? (
            <span className="text-[0.75rem] text-ink-3">{relative}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-[0.8125rem]">
          {moneyIn > 0 ? (
            <span className="money text-[var(--in-text)]">+{formatMoney(moneyIn)}</span>
          ) : null}
          {moneyOut > 0 ? (
            <span className="money text-[var(--out-text)]">−{formatMoney(moneyOut)}</span>
          ) : null}
        </div>
      </header>

      <EntryList entries={entries} context={context} />
    </section>
  );
}

/** Groups a flat, date-descending list into day buckets, preserving order. */
export function groupByDay(entries: LedgerEntry[]): Array<{ day: DayString; entries: LedgerEntry[] }> {
  const groups: Array<{ day: DayString; entries: LedgerEntry[] }> = [];

  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.day === entry.day) last.entries.push(entry);
    else groups.push({ day: entry.day, entries: [entry] });
  }

  return groups;
}
