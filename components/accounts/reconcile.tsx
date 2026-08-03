'use client';

import { Scales } from '@phosphor-icons/react/dist/csr/Scales';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { reconcileAccount } from '@/app/actions/accounts';
import type { DayString } from '@/lib/date';
import { formatMoney, parseAmount } from '@/lib/money';

import { Button } from '../ui/button';
import { Input } from '../ui/primitives';

/**
 * The answer to "sometimes I have 1000 and sometimes 0 and I do not know why".
 *
 * You open your banking app, type what it actually says, and the gap becomes a
 * named row in the ledger instead of quietly poisoning every number above it.
 */
export function Reconcile({
  accountId,
  accountName,
  expected,
  today,
}: {
  accountId: string;
  accountName: string;
  expected: number;
  today: DayString;
}) {
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState('');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  const parsed = parseAmount(actual);
  const difference = parsed === null ? null : parsed - expected;

  const submit = () => {
    if (parsed === null) {
      toast.error('Type the balance your bank shows');
      return;
    }

    startTransition(async () => {
      const result = await reconcileAccount({
        accountId,
        day: today,
        actualBalance: parsed,
        note: note.trim() || null,
      });

      if (result.ok) {
        const diff = result.data.difference;
        toast.success(
          diff === 0
            ? 'Spot on, nothing was missing'
            : diff > 0
              ? `Found ${formatMoney(diff)} you had not logged`
              : `${formatMoney(-diff)} had gone out untracked`,
        );
        setOpen(false);
        setActual('');
        setNote('');
      } else {
        toast.error(result.error);
      }
    });
  };

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Scales size={13} />
        Check against reality
      </Button>
    );
  }

  return (
    <div className="mt-3 rounded-sm border border-line bg-surface-2 p-3">
      <p className="text-[0.8125rem] text-ink-2">
        Hisaab thinks {accountName} holds{' '}
        <span className="money text-ink">{formatMoney(expected)}</span>. What does it actually say?
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Input
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          inputMode="decimal"
          autoFocus
          placeholder="Real balance"
          aria-label={`Actual balance in ${accountName}`}
          className="h-8 w-32"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What do you think it was?"
          className="h-8 min-w-0 flex-1"
        />
      </div>

      {difference !== null && difference !== 0 ? (
        <p className="mt-2 text-[0.8125rem] text-ink-2">
          That is{' '}
          <span
            className={
              difference > 0 ? 'money text-[var(--in-text)]' : 'money text-[var(--out-text)]'
            }
          >
            {difference > 0 ? '+' : '−'}
            {formatMoney(Math.abs(difference))}
          </span>{' '}
          {difference > 0 ? 'more than expected, so something came in unlogged.' : 'missing, so something went out unlogged.'}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={submit} disabled={pending}>
          Record it
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
