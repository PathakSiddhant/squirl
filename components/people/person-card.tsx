'use client';

import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { closeDebt, recordRepayment } from '@/app/actions/debts';
import { cn } from '@/lib/cn';
import { formatDay, formatRelativeDay, type DayString } from '@/lib/date';
import { describeTerms } from '@/lib/domain/interest';
import { formatMoney, parseAmount } from '@/lib/money';

import { Button } from '../ui/button';
import { Input } from '../ui/primitives';

export interface DebtView {
  id: string;
  direction: 'lent' | 'borrowed';
  openedOn: DayString;
  dueOn: DayString | null;
  interestKind: 'none' | 'simple' | 'compound';
  rateBpsPerMonth: number;
  note: string | null;
  outstandingPrincipal: number;
  accruedInterest: number;
  payoffTotal: number;
  principalAdvanced: number;
  totalRepaid: number;
}

export interface PersonView {
  id: string;
  name: string;
  net: number;
  owedToYou: number;
  youOwe: number;
  hasOverdue: boolean;
  debts: DebtView[];
}

/**
 * One person, and exactly where you stand with them.
 *
 * The headline is the net position, because that is the question actually
 * being asked. The individual agreements sit underneath for when the answer
 * needs unpacking.
 */
export function PersonCard({
  person,
  accounts,
  today,
}: {
  person: PersonView;
  accounts: Array<{ id: string; name: string }>;
  today: DayString;
}) {
  const [open, setOpen] = useState(false);
  const settled = person.debts.length === 0;

  return (
    <section className="rounded-md border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={settled}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-[var(--t-state)] enabled:hover:bg-surface-2"
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[0.8125rem] font-medium text-ink-2"
        >
          {person.name.slice(0, 1).toUpperCase()}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] text-ink">{person.name}</span>
          <span className="block truncate text-[0.75rem] text-ink-3">
            {settled
              ? 'All settled'
              : `${person.debts.length} open ${person.debts.length === 1 ? 'agreement' : 'agreements'}`}
            {person.hasOverdue ? (
              <span className="ml-1.5 text-[var(--i-owe-text)]">past the date</span>
            ) : null}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span
            className={cn(
              'money block text-[0.9375rem]',
              person.net > 0
                ? 'text-[var(--owed-me-text)]'
                : person.net < 0
                  ? 'text-[var(--i-owe-text)]'
                  : 'text-ink-3',
            )}
          >
            {formatMoney(Math.abs(person.net))}
          </span>
          <span className="block text-[0.75rem] text-ink-3">
            {person.net > 0 ? 'owes you' : person.net < 0 ? 'you owe' : 'settled'}
          </span>
        </span>

        {!settled ? (
          <CaretDown
            size={14}
            className={cn('shrink-0 text-ink-3 transition-transform duration-[var(--t-move)]', open && 'rotate-180')}
          />
        ) : null}
      </button>

      {open ? (
        <div className="divide-y divide-line border-t border-line">
          {person.debts.map((debt) => (
            <DebtRow key={debt.id} debt={debt} accounts={accounts} today={today} personName={person.name} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DebtRow({
  debt,
  accounts,
  today,
  personName,
}: {
  debt: DebtView;
  accounts: Array<{ id: string; name: string }>;
  today: DayString;
  personName: string;
}) {
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [pending, startTransition] = useTransition();

  const overdue = debt.dueOn ? debt.dueOn < today : false;
  const isLent = debt.direction === 'lent';

  const submit = (full: boolean) => {
    const value = full ? debt.payoffTotal : parseAmount(amount);
    if (!value || value <= 0) {
      toast.error('Enter an amount');
      return;
    }

    startTransition(async () => {
      const result = await recordRepayment({
        debtId: debt.id,
        amount: value,
        // Interest is cleared before principal, matching how people settle up.
        interestPart: Math.min(value, debt.accruedInterest),
        day: today,
        accountId,
        method: 'upi',
      });

      if (result.ok) {
        setAmount('');
        toast.success(isLent ? 'Money back in' : 'Paid back');
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.875rem] text-ink">
            {isLent ? `You lent ${personName}` : `${personName} lent you`}{' '}
            <span className="money">{formatMoney(debt.principalAdvanced)}</span>
          </p>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">
            since {formatDay(debt.openedOn, today)} · {describeTerms(debt)}
            {debt.dueOn ? (
              <>
                {' '}
                ·{' '}
                <span className={overdue ? 'text-[var(--i-owe-text)]' : undefined}>
                  {overdue ? 'due ' : ''}
                  {formatRelativeDay(debt.dueOn, today)}
                </span>
              </>
            ) : null}
          </p>
          {debt.note ? <p className="mt-1 text-[0.75rem] text-ink-3">{debt.note}</p> : null}
        </div>

        <div className="text-right">
          <p className="money text-[0.9375rem] text-ink">{formatMoney(debt.payoffTotal)}</p>
          {debt.accruedInterest > 0 ? (
            <p className="text-[0.75rem] text-ink-3">
              incl. {formatMoney(debt.accruedInterest)} interest
            </p>
          ) : null}
        </div>
      </div>

      {debt.totalRepaid > 0 ? (
        <p className="mt-1.5 text-[0.75rem] text-ink-3">
          {formatMoney(debt.totalRepaid)} of {formatMoney(debt.principalAdvanced)} already back
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit(false);
            }
          }}
          inputMode="decimal"
          placeholder="Amount"
          aria-label={`Amount ${isLent ? 'received from' : 'paid to'} ${personName}`}
          className="h-8 w-28"
        />
        {accounts.length > 1 ? (
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            aria-label="Account"
            className="h-8 rounded-sm border border-line bg-surface px-2 text-[0.8125rem] text-ink-2"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : null}
        <Button size="sm" variant="primary" disabled={pending} onClick={() => submit(false)}>
          {isLent ? 'Got some back' : 'Paid some'}
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => submit(true)}>
          Settle all
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await closeDebt(debt.id, 'written_off', today);
              if (result.ok) toast.success('Written off');
              else toast.error(result.error);
            })
          }
        >
          Write off
        </Button>
      </div>
    </div>
  );
}
