'use client';

import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';
import type { LedgerEntry } from '@/lib/queries/ledger';

import { KIND_META, METHOD_LABEL, TONE_TEXT, TONE_WASH } from '../money/kind';
import { Icon } from '../shell/icon';
import { Button } from '../ui/button';
import { EntryEditor, type EditableEntry, type EditorContext } from './entry-editor';

/**
 * A list of movements, every one of them editable.
 *
 * Rows are buttons rather than static text because the single most common
 * follow-up to logging something quickly is fixing what it guessed.
 */
export function EntryList({
  entries,
  context,
  showDay = false,
  className,
}: {
  entries: LedgerEntry[];
  context: EditorContext;
  showDay?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState<EditableEntry | null>(null);
  const [open, setOpen] = useState(false);

  const edit = (entry: LedgerEntry) => {
    setEditing({
      id: entry.id,
      day: entry.day,
      kind: entry.kind,
      amount: entry.amount,
      accountId: entry.accountId,
      counterAccountId: entry.counterAccountId,
      categoryId: entry.categoryId,
      personId: entry.personId,
      method: entry.method,
      note: entry.note,
      interestPart: entry.interestPart,
      debtId: entry.debtId,
      loanId: entry.loanId,
      installmentId: entry.installmentId,
    });
    setOpen(true);
  };

  return (
    <>
      <div className={cn('divide-y divide-line', className)}>
        {entries.map((entry) => (
          <Row key={entry.id} entry={entry} showDay={showDay} onEdit={() => edit(entry)} />
        ))}
      </div>

      <EntryEditor entry={editing} context={context} open={open} onOpenChange={setOpen} />
    </>
  );
}

function Row({
  entry,
  showDay,
  onEdit,
}: {
  entry: LedgerEntry;
  showDay: boolean;
  onEdit: () => void;
}) {
  const meta = KIND_META[entry.kind];

  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-[var(--t-state)] hover:bg-surface-2"
    >
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

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] text-ink">{describeTitle(entry)}</span>
        <span className="block truncate text-[0.75rem] text-ink-3">{describeDetails(entry)}</span>
      </span>

      <span className="shrink-0 text-right">
        <span className={cn('money block text-[0.875rem]', TONE_TEXT[meta.tone])}>
          {meta.direction === 'in' ? '+' : meta.direction === 'out' ? '−' : ''}
          {formatMoney(entry.amount)}
        </span>
        {showDay ? <span className="block text-[0.75rem] text-ink-3">{entry.day.slice(8)}</span> : null}
        {entry.interestPart > 0 ? (
          <span className="block text-[0.6875rem] text-ink-3">
            {formatMoney(entry.interestPart)} interest
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** The "add without the syntax" button, for anyone who would rather use a form. */
export function AddEntryButton({
  context,
  className,
}: {
  context: EditorContext;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="md" className={className} onClick={() => setOpen(true)}>
        <Plus size={14} weight="bold" />
        Add by form
      </Button>
      <EntryEditor entry={null} context={context} open={open} onOpenChange={setOpen} />
    </>
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
      return 'Value went up';
    case 'adjust_down':
      return 'Value went down';
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

  const method = METHOD_LABEL[entry.method] ?? entry.method;
  if (method.toLowerCase() !== entry.accountName?.toLowerCase()) parts.push(method);

  return parts.join(' · ');
}
