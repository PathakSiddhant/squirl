'use client';

import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  archivePerson,
  closeDebt,
  deleteDebt,
  deletePerson,
  recordRepayment,
  reopenDebt,
} from '@/app/actions/debts';
import { cn } from '@/lib/cn';
import { formatDay, formatRelativeDay, type DayString } from '@/lib/date';
import { describeTerms } from '@/lib/domain/interest';
import { formatMoney, parseAmount } from '@/lib/money';

import { Button } from '../ui/button';
import { ConfirmButton } from '../ui/confirm-button';
import { Input } from '../ui/primitives';

export interface DebtView {
  id: string;
  direction: 'lent' | 'borrowed';
  status: 'open' | 'settled' | 'written_off';
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
  movementCount: number;
}

export interface PersonView {
  id: string;
  name: string;
  net: number;
  owedToYou: number;
  youOwe: number;
  hasOverdue: boolean;
  debts: DebtView[];
  closedDebts: DebtView[];
}

/**
 * One person, and exactly where you stand with them.
 *
 * The headline is the net position, because that is the question actually
 * being asked. Closed agreements stay listed underneath rather than vanishing,
 * so a write-off can be undone and a mistake can be erased.
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
  const [pending, startTransition] = useTransition();

  const hasAnything = person.debts.length > 0 || person.closedDebts.length > 0;
  const settled = person.debts.length === 0;

  return (
    <section className="rounded-md border border-line bg-surface">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
              {person.debts.length > 0
                ? `${person.debts.length} open ${person.debts.length === 1 ? 'agreement' : 'agreements'}`
                : person.closedDebts.length > 0
                  ? `${person.closedDebts.length} closed, nothing outstanding`
                  : 'No agreements yet'}
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

          {hasAnything ? (
            <CaretDown
              size={14}
              className={cn(
                'shrink-0 text-ink-3 transition-transform duration-[var(--t-move)]',
                open && 'rotate-180',
              )}
            />
          ) : null}
        </button>
      </div>

      {open || !hasAnything ? (
        <div className="border-t border-line">
          {person.debts.map((debt) => (
            <DebtRow
              key={debt.id}
              debt={debt}
              accounts={accounts}
              today={today}
              personName={person.name}
            />
          ))}

          {person.closedDebts.length > 0 ? (
            <div className="border-t border-line bg-surface-2/40">
              <p className="px-4 pt-2.5 text-[0.75rem] font-medium text-ink-3">Closed</p>
              {person.closedDebts.map((debt) => (
                <ClosedDebtRow key={debt.id} debt={debt} today={today} personName={person.name} />
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-2.5">
            <span className="mr-auto text-[0.75rem] text-ink-3">
              {settled
                ? 'Nothing outstanding with them.'
                : 'Settle everything before removing them.'}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await archivePerson(person.id);
                  if (result.ok) toast.success(`${person.name} hidden`);
                  else toast.error(result.error);
                })
              }
            >
              Hide
            </Button>
            <ConfirmButton
              confirmLabel={
                person.debts.length + person.closedDebts.length > 0
                  ? 'Delete them and their history?'
                  : 'Delete for good?'
              }
              disabled={pending}
              onConfirm={async () => {
                const result = await deletePerson(person.id);
                if (result.ok) toast.success(`${person.name} deleted`);
                else toast.error(result.error);
              }}
            >
              Delete person
            </ConfirmButton>
          </div>
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
    <div className="border-b border-line px-4 py-3 last:border-b-0">
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

        <span className="ml-auto flex items-center gap-1">
          <ConfirmButton
            confirmLabel="Write it off?"
            disabled={pending}
            onConfirm={async () => {
              const result = await closeDebt(debt.id, 'written_off', today);
              if (result.ok) toast.success('Written off, and kept in the record');
              else toast.error(result.error);
            }}
          >
            Write off
          </ConfirmButton>
          <ConfirmButton
            confirmLabel={debt.movementCount > 0 ? `Erase and ${debt.movementCount} entries?` : 'Erase it?'}
            disabled={pending}
            onConfirm={async () => {
              const result = await deleteDebt(debt.id);
              if (result.ok) {
                toast.success(
                  result.data.removed > 0
                    ? `Deleted, along with ${result.data.removed} ${result.data.removed === 1 ? 'entry' : 'entries'}`
                    : 'Deleted',
                );
              } else {
                toast.error(result.error);
              }
            }}
          >
            Delete
          </ConfirmButton>
        </span>
      </div>
    </div>
  );
}

function ClosedDebtRow({
  debt,
  today,
  personName,
}: {
  debt: DebtView;
  today: DayString;
  personName: string;
}) {
  const [pending, startTransition] = useTransition();
  const isLent = debt.direction === 'lent';

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.8125rem] text-ink-2">
          {isLent ? `Lent ${personName}` : `Borrowed from ${personName}`}{' '}
          <span className="money">{formatMoney(debt.principalAdvanced)}</span>
          <span className="ml-1.5 text-ink-3">
            {debt.status === 'written_off' ? 'written off' : 'settled'}
          </span>
        </p>
        <p className="text-[0.75rem] text-ink-3">
          opened {formatDay(debt.openedOn, today)}
          {debt.movementCount === 0 ? ' · no entries recorded' : ''}
        </p>
      </div>

      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await reopenDebt(debt.id);
            if (result.ok) toast.success('Reopened');
            else toast.error(result.error);
          })
        }
      >
        Reopen
      </Button>
      <ConfirmButton
        confirmLabel={debt.movementCount > 0 ? `Erase and ${debt.movementCount} entries?` : 'Erase it?'}
        disabled={pending}
        onConfirm={async () => {
          const result = await deleteDebt(debt.id);
          if (result.ok) toast.success('Deleted');
          else toast.error(result.error);
        }}
      >
        Delete
      </ConfirmButton>
    </div>
  );
}
