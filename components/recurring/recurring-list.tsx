'use client';

import { Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { deleteRecurring, postRecurringNow, setRecurringActive } from '@/app/actions/recurring';
import { cn } from '@/lib/cn';
import { formatDay, formatRelativeDay, type DayString } from '@/lib/date';
import { describeInterval } from '@/lib/domain/recurring';
import { formatMoney } from '@/lib/money';

import { Icon } from '../shell/icon';
import { Button } from '../ui/button';
import { ConfirmButton } from '../ui/confirm-button';
import { RecurringForm, type RecurringEditable, type RecurringOptions } from './recurring-form';

export interface RecurringRow extends RecurringEditable {
  accountName: string | null;
  counterAccountName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  nextDueOn: DayString;
  lastPostedOn: DayString | null;
  postedCount: number;
  active: boolean;
  overdue: DayString[];
  perYear: number;
  finished: boolean;
}

export function RecurringList({
  rows,
  options,
  today,
}: {
  rows: RecurringRow[];
  options: RecurringOptions;
  today: DayString;
}) {
  const [editing, setEditing] = useState<RecurringEditable | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <Row
            key={row.id}
            row={row}
            today={today}
            onEdit={() => {
              setEditing(row);
              setOpen(true);
            }}
          />
        ))}
      </div>
      <RecurringForm existing={editing} options={options} open={open} onOpenChange={setOpen} />
    </>
  );
}

function Row({ row, today, onEdit }: { row: RecurringRow; today: DayString; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  const direction = row.kind === 'income' ? 'in' : row.kind === 'transfer' ? 'flat' : 'out';
  const waiting = row.overdue.length > 0 && !row.autoPost;

  return (
    <section
      className={cn(
        'rounded-md border bg-surface',
        waiting ? 'border-line-strong' : 'border-line',
        !row.active && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-sm',
            row.autoPost ? 'bg-[var(--acorn-wash)] text-[var(--acorn-deep)]' : 'bg-surface-2 text-ink-2',
          )}
        >
          <Icon name={row.categoryIcon ?? 'Repeat'} size={15} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[0.9375rem] text-ink">
            {row.name}
            {row.autoPost ? (
              <span
                title="Logs itself on the date"
                className="inline-flex items-center gap-0.5 rounded-sm bg-[var(--acorn-wash)] px-1 py-px text-[0.625rem] font-medium text-[var(--acorn-deep)]"
              >
                <Lightning size={9} weight="fill" />
                auto
              </span>
            ) : null}
          </p>
          <p className="truncate text-[0.75rem] text-ink-3">
            {describeInterval(row.intervalUnit, row.intervalCount)}
            {row.categoryName ? ` · ${row.categoryName}` : ''}
            {row.accountName ? ` · ${row.accountName}` : ''}
            {row.counterAccountName ? ` → ${row.counterAccountName}` : ''}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={cn(
              'money text-[0.9375rem]',
              direction === 'in' ? 'text-[var(--in-text)]' : 'text-ink',
            )}
          >
            {direction === 'in' ? '+' : direction === 'out' ? '−' : ''}
            {formatMoney(row.amount)}
          </p>
          <p className="text-[0.75rem] text-ink-3">
            {row.finished
              ? 'finished'
              : !row.active
                ? 'paused'
                : `next ${formatRelativeDay(row.nextDueOn, today)}`}
          </p>
        </div>
      </div>

      {waiting ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-4 py-2.5">
          <span className="mr-auto text-[0.8125rem] text-ink-2">
            {row.overdue.length === 1
              ? `Due ${formatDay(row.overdue[0], today)}. Did it go through?`
              : `${row.overdue.length} charges due since ${formatDay(row.overdue[0], today)}.`}
          </span>
          <Button
            size="sm"
            variant="primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await postRecurringNow(row.id, today);
                if (result.ok) {
                  toast.success(
                    result.data.posted === 1 ? 'Logged' : `Logged ${result.data.posted} charges`,
                  );
                } else {
                  toast.error(result.error);
                }
              })
            }
          >
            Yes, log it
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">
        <span className="mr-auto text-[0.75rem] text-ink-3">
          {formatMoney(row.perYear)} a year
          {row.postedCount > 0 ? ` · ${row.postedCount} logged so far` : ''}
          {row.lastPostedOn ? ` · last ${formatDay(row.lastPostedOn, today)}` : ''}
        </span>

        <Button size="sm" variant="ghost" onClick={onEdit} disabled={pending}>
          Edit
        </Button>
        {!row.finished ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await setRecurringActive(row.id, !row.active);
                if (result.ok) toast.success(row.active ? 'Paused' : 'Resumed');
                else toast.error(result.error);
              })
            }
          >
            {row.active ? 'Pause' : 'Resume'}
          </Button>
        ) : null}
        <ConfirmButton
          confirmLabel="Stop tracking it?"
          disabled={pending}
          onConfirm={async () => {
            const result = await deleteRecurring(row.id);
            if (result.ok) toast.success('Removed. Past charges stay in your history.');
            else toast.error(result.error);
          }}
        >
          Delete
        </ConfirmButton>
      </div>
    </section>
  );
}
