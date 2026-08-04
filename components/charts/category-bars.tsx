import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';

import { Icon } from '../shell/icon';

/**
 * Where the money went, ranked.
 *
 * A ranked bar list, not a pie: comparing angles is harder than comparing
 * lengths, and there are usually more than six categories, which is where pies
 * stop working entirely. Values are labelled directly, so no legend is needed.
 */
export function CategoryBars({
  rows,
  total,
  tone = 'out',
}: {
  rows: Array<{ categoryId: string; name: string; icon: string; total: number; count: number }>;
  total: number;
  /** Money direction. Income must never be drawn in the spending colour. */
  tone?: 'out' | 'in';
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 pb-5 text-[0.875rem] text-ink-3">
        Nothing {tone === 'out' ? 'spent' : 'received'} in this window.
      </p>
    );
  }

  const max = Math.max(...rows.map((r) => r.total), 1);
  const bar = tone === 'out' ? 'bg-[var(--out)]' : 'bg-[var(--in)]';
  const chip =
    tone === 'out'
      ? 'bg-[var(--out-wash)] text-[var(--out-text)]'
      : 'bg-[var(--in-wash)] text-[var(--in-text)]';

  return (
    <ul className="divide-y divide-line border-t border-line">
      {rows.map((row) => {
        const share = total > 0 ? (row.total / total) * 100 : 0;
        return (
          <li key={row.categoryId} className="px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-sm', chip)}>
                <Icon name={row.icon} size={13} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.875rem] text-ink">{row.name}</span>
              <span className="money shrink-0 text-[0.875rem] text-ink">{formatMoney(row.total)}</span>
              <span className="money w-10 shrink-0 text-right text-[0.75rem] text-ink-3">
                {share.toFixed(0)}%
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-2 pl-8.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn('h-full rounded-full', bar)}
                  style={{ width: `${(row.total / max) * 100}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-[0.6875rem] text-ink-3">
                {row.count} {row.count === 1 ? 'time' : 'times'}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
