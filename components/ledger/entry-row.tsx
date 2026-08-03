import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import type { LedgerEntry } from '@/lib/queries/ledger';

import { KIND_META, METHOD_LABEL, TONE_TEXT, TONE_WASH } from '../money/kind';
import { Icon } from '../shell/icon';

/**
 * One movement.
 *
 * The title answers "what was this" and the subtitle answers "how did it
 * move", which together are the two things you need when scanning a month of
 * UPI taps trying to work out where the money went.
 */
export function EntryRow({ entry, showDay = false }: { entry: LedgerEntry; showDay?: boolean }) {
  const meta = KIND_META[entry.kind];
  const title = describeTitle(entry);
  const details = describeDetails(entry);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-[var(--t-state)] hover:bg-surface-2">
      <span
        aria-hidden
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-sm',
          TONE_WASH[meta.tone],
          TONE_TEXT[meta.tone],
        )}
      >
        <Icon name={entry.categoryIcon ?? meta.icon} size={14} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.875rem] text-ink">{title}</p>
        <p className="truncate text-[0.75rem] text-ink-3">{details}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn('money text-[0.875rem]', TONE_TEXT[meta.tone])}>
          {meta.direction === 'in' ? '+' : meta.direction === 'out' ? '−' : ''}
          {formatMoney(entry.amount)}
        </p>
        {showDay ? <p className="text-[0.75rem] text-ink-3">{entry.day.slice(8)}</p> : null}
        {entry.interestPart > 0 ? (
          <p className="text-[0.6875rem] text-ink-3">
            {formatMoney(entry.interestPart)} interest
          </p>
        ) : null}
      </div>
    </div>
  );
}

function describeTitle(entry: LedgerEntry): string {
  if (entry.note) return entry.note;

  switch (entry.kind) {
    case 'transfer':
      return `${entry.accountName ?? 'Account'} to ${entry.counterAccountName ?? 'account'}`;
    case 'lend':
      return `Lent to ${entry.personName ?? 'someone'}`;
    case 'borrow':
      return `Borrowed from ${entry.personName ?? 'someone'}`;
    case 'collect':
      return `${entry.personName ?? 'Someone'} paid back`;
    case 'settle':
      return `Paid back ${entry.personName ?? 'someone'}`;
    case 'loan_taken':
      return `${entry.lenderName ?? 'Loan'} disbursed`;
    case 'loan_payment':
      return entry.installmentSeq
        ? `${entry.lenderName ?? 'Loan'}, EMI ${entry.installmentSeq}`
        : `${entry.lenderName ?? 'Loan'} payment`;
    case 'adjust_up':
      return 'Reconciled, found extra';
    case 'adjust_down':
      return 'Reconciled, money missing';
    default:
      return entry.categoryName ?? KIND_META[entry.kind].label;
  }
}

function describeDetails(entry: LedgerEntry): string {
  const parts: string[] = [];

  if (entry.categoryName && entry.note) parts.push(entry.categoryName);
  if (entry.kind === 'transfer') parts.push('Moved, not spent');
  else if (entry.kind === 'lend') parts.push('Still yours, just not with you');
  else if (entry.kind === 'borrow') parts.push('Has to go back');

  if (entry.accountName && entry.kind !== 'transfer') parts.push(entry.accountName);
  parts.push(METHOD_LABEL[entry.method] ?? entry.method);

  return parts.join(' · ');
}
