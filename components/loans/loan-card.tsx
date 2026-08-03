'use client';

import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { payInstallment } from '@/app/actions/loans';
import { cn } from '@/lib/cn';
import { formatDay, formatRelativeDay, type DayString } from '@/lib/date';
import { formatMoney } from '@/lib/money';

import { Button } from '../ui/button';

export interface InstallmentView {
  id: string;
  seq: number;
  dueOn: DayString;
  amount: number;
  principalPart: number;
  interestPart: number;
  status: 'due' | 'paid' | 'skipped';
  paidOn: DayString | null;
}

export interface LoanView {
  id: string;
  lender: string;
  principal: number;
  takenOn: DayString;
  status: 'active' | 'closed' | 'foreclosed';
  note: string | null;
  schedule: InstallmentView[];
  paidCount: number;
  remainingTotal: number;
  totalInterest: number;
  effectiveApr: number | null;
  progress: number;
}

/**
 * A loan, its schedule, and what it is really costing.
 *
 * The effective APR is shown deliberately. "Borrow 1,500, repay 550 for three
 * months" reads as a 10% fee, but the principal is shrinking the whole time,
 * so the real rate is around 78% a year. That number should not be hidden.
 */
export function LoanCard({
  loan,
  accounts,
  today,
}: {
  loan: LoanView;
  accounts: Array<{ id: string; name: string }>;
  today: DayString;
}) {
  const [pending, startTransition] = useTransition();
  const overdue = loan.schedule.filter((i) => i.status === 'due' && i.dueOn < today);
  const isClosed = loan.status !== 'active';

  const pay = (installmentId: string) => {
    startTransition(async () => {
      const result = await payInstallment(installmentId, today, accounts[0]?.id ?? '');
      if (result.ok) toast.success('Installment marked paid');
      else toast.error(result.error);
    });
  };

  return (
    <section className="overflow-hidden rounded-md border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[0.9375rem] font-semibold text-ink">{loan.lender}</h2>
            {isClosed ? (
              <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-[0.6875rem] font-medium text-ink-3">
                Closed
              </span>
            ) : overdue.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--i-owe-wash)] px-1.5 py-0.5 text-[0.6875rem] font-medium text-[var(--i-owe-text)]">
                <Warning size={10} weight="fill" />
                {overdue.length} missed
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">
            Took {formatMoney(loan.principal)} on {formatDay(loan.takenOn, today)} ·{' '}
            {formatMoney(loan.totalInterest)} interest over {loan.schedule.length} months
          </p>
        </div>

        <div className="text-right">
          <p className="money text-[1.0625rem] text-ink">{formatMoney(loan.remainingTotal)}</p>
          <p className="text-[0.75rem] text-ink-3">still to pay</p>
        </div>
      </header>

      <div className="px-4 pb-3">
        {/* Progress as discrete blocks, one per installment: at three months a
            continuous bar would be less legible than simply counting them. */}
        <div className="flex items-center gap-1" role="img" aria-label={`${loan.paidCount} of ${loan.schedule.length} installments paid`}>
          {loan.schedule.map((item) => (
            <span
              key={item.id}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                item.status === 'paid'
                  ? 'bg-ink'
                  : item.dueOn < today
                    ? 'bg-[var(--i-owe)]'
                    : 'bg-surface-3',
              )}
            />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[0.75rem] text-ink-3">
          <span>
            {loan.paidCount} of {loan.schedule.length} paid
          </span>
          {loan.effectiveApr !== null && loan.effectiveApr > 0 ? (
            <span className={loan.effectiveApr > 36 ? 'text-[var(--i-owe-text)]' : undefined}>
              works out to {loan.effectiveApr.toFixed(0)}% a year
            </span>
          ) : null}
        </div>
      </div>

      <ul className="divide-y divide-line border-t border-line">
        {loan.schedule.map((item) => {
          const isOverdue = item.status === 'due' && item.dueOn < today;
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-medium',
                  item.status === 'paid'
                    ? 'bg-surface-2 text-ink-3'
                    : isOverdue
                      ? 'bg-[var(--i-owe-wash)] text-[var(--i-owe-text)]'
                      : 'bg-surface-2 text-ink-2',
                )}
              >
                {item.seq}
              </span>

              <div className="min-w-0 flex-1">
                <p className={cn('text-[0.875rem]', item.status === 'paid' ? 'text-ink-3' : 'text-ink')}>
                  {formatMoney(item.amount)}
                </p>
                <p className="text-[0.75rem] text-ink-3">
                  {formatMoney(item.principalPart)} principal
                  {item.interestPart > 0 ? ` · ${formatMoney(item.interestPart)} interest` : ''}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {item.status === 'paid' ? (
                  <span className="text-[0.75rem] text-ink-3">
                    paid {item.paidOn ? formatDay(item.paidOn, today) : ''}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-[0.75rem]',
                        isOverdue ? 'text-[var(--i-owe-text)]' : 'text-ink-3',
                      )}
                    >
                      {isOverdue ? 'overdue' : formatRelativeDay(item.dueOn, today)}
                    </span>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => pay(item.id)}>
                      Mark paid
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
