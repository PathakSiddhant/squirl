'use client';

import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createDebt } from '@/app/actions/debts';
import { cn } from '@/lib/cn';
import { addDays, type DayString } from '@/lib/date';
import { parseAmount } from '@/lib/money';

import { Button } from '../ui/button';
import { Field, Input } from '../ui/primitives';

/**
 * Opening an agreement with someone.
 *
 * Interest is off by default and stays hidden until asked for, because most
 * money between friends carries none and a rate field on every form is noise.
 */
export function NewDebtForm({
  people,
  accounts,
  today,
}: {
  people: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  today: DayString;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'lent' | 'borrowed'>('lent');
  const [personId, setPersonId] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [dueOn, setDueOn] = useState<string>(addDays(today, 30));
  const [withInterest, setWithInterest] = useState(false);
  const [rate, setRate] = useState('1');
  const [interestKind, setInterestKind] = useState<'simple' | 'compound'>('simple');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus size={14} weight="bold" />
        New agreement
      </Button>
    );
  }

  const submit = () => {
    const value = parseAmount(amount);
    if (!value || value <= 0) {
      toast.error('Enter an amount');
      return;
    }
    if (!personId && !newPersonName.trim()) {
      toast.error('Who is this with?');
      return;
    }

    startTransition(async () => {
      const result = await createDebt({
        personId: personId || null,
        newPersonName: personId ? null : newPersonName.trim(),
        direction,
        amount: value,
        openedOn: today,
        dueOn: dueOn || null,
        interestKind: withInterest ? interestKind : 'none',
        ratePctPerMonth: withInterest ? Number(rate) || 0 : 0,
        accountId,
        method: 'upi',
        note: note.trim() || null,
      });

      if (result.ok) {
        toast.success(direction === 'lent' ? 'Lent, and tracked' : 'Borrowed, and tracked');
        setOpen(false);
        setAmount('');
        setNote('');
        setNewPersonName('');
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="mb-4 flex items-center gap-1">
        {(['lent', 'borrowed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={direction === value}
            onClick={() => setDirection(value)}
            className={cn(
              'rounded-sm px-2.5 py-1 text-[0.8125rem] transition-colors duration-[var(--t-state)]',
              direction === value ? 'bg-surface-3 font-medium text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {value === 'lent' ? 'I lent money' : 'I borrowed money'}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Who">
          {people.length > 0 ? (
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="h-9 w-full rounded-sm border border-line bg-surface px-2 text-[0.875rem] text-ink"
            >
              <option value="">Someone new</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}
          {!personId ? (
            <Input
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              placeholder="Their name"
              className={people.length > 0 ? 'mt-2' : undefined}
            />
          ) : null}
        </Field>

        <Field label="How much">
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="1000"
          />
        </Field>

        <Field label={direction === 'lent' ? 'Paid from' : 'Received into'}>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="h-9 w-full rounded-sm border border-line bg-surface px-2 text-[0.875rem] text-ink"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Expected back by" hint="Leave it if there is no date">
          <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </Field>
      </div>

      <label className="mt-3 flex items-center gap-2 text-[0.875rem] text-ink-2">
        <input
          type="checkbox"
          checked={withInterest}
          onChange={(e) => setWithInterest(e.target.checked)}
          className="size-3.5 accent-[var(--ink)]"
        />
        There is interest on this
      </label>

      {withInterest ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Rate, percent a month">
            <Input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="How it grows">
            <select
              value={interestKind}
              onChange={(e) => setInterestKind(e.target.value as 'simple' | 'compound')}
              className="h-9 w-full rounded-sm border border-line bg-surface px-2 text-[0.875rem] text-ink"
            >
              <option value="simple">Simple, on the principal</option>
              <option value="compound">Compounding monthly</option>
            </select>
          </Field>
        </div>
      ) : null}

      <Field label="Note" className="mt-3">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What it was for"
        />
      </Field>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="primary" onClick={submit} disabled={pending}>
          {direction === 'lent' ? 'Record what I lent' : 'Record what I borrowed'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
