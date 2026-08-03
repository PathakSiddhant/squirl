import { Bank } from '@phosphor-icons/react/dist/ssr/Bank';

import { LoanCard, type LoanView } from '@/components/loans/loan-card';
import { NewLoanForm } from '@/components/loans/new-loan-form';
import { Empty, PageHeader } from '@/components/ui/primitives';
import { today as istToday } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { getLoansWithSchedules } from '@/lib/queries/loans';
import { getAccounts } from '@/lib/queries/reference';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Loans' };

export default async function LoansPage() {
  const asOf = istToday();
  const [entries, accounts] = await Promise.all([getLoansWithSchedules(asOf), getAccounts()]);

  const active = entries.filter((e) => e.loan.status === 'active');
  const closed = entries.filter((e) => e.loan.status !== 'active');

  const outstanding = active.reduce((n, e) => n + e.remainingTotal, 0);
  const interestAhead = active.reduce(
    (n, e) => n + e.schedule.filter((i) => i.status === 'due').reduce((m, i) => m + i.interestPart, 0),
    0,
  );

  const spendable = accounts.filter((a) => a.kind !== 'parked').map((a) => ({ id: a.id, name: a.name }));

  const toView = (entry: (typeof entries)[number]): LoanView => ({
    id: entry.loan.id,
    lender: entry.loan.lender,
    principal: entry.loan.principal,
    takenOn: entry.loan.takenOn,
    status: entry.loan.status,
    note: entry.loan.note,
    schedule: entry.schedule.map((i) => ({
      id: i.id,
      seq: i.seq,
      dueOn: i.dueOn,
      amount: i.amount,
      principalPart: i.principalPart,
      interestPart: i.interestPart,
      status: i.status,
      paidOn: i.paidOn,
    })),
    paidCount: entry.paidCount,
    remainingTotal: entry.remainingTotal,
    totalInterest: entry.totalInterest,
    effectiveApr: entry.effectiveApr,
    progress: entry.progress,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Loans"
        subtitle={
          active.length === 0
            ? 'Structured borrowing with a repayment schedule'
            : `${formatMoney(outstanding)} left across ${active.length} active ${active.length === 1 ? 'loan' : 'loans'}`
        }
        action={<NewLoanForm accounts={spendable} today={asOf} />}
      />

      {active.length > 0 ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
          <Stat label="Still to pay" value={formatMoney(outstanding)} />
          <Stat label="Interest still ahead" value={formatMoney(interestAhead)} />
          <Stat
            label="Next due"
            value={
              active
                .map((e) => e.nextDue?.dueOn)
                .filter(Boolean)
                .sort()[0] ?? 'nothing'
            }
            mono={false}
          />
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <Empty
            icon={<Bank size={22} />}
            title="No loans"
            body="Add one and Hisaab builds the full installment schedule, then counts every upcoming payment against what is safe to spend today."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((entry) => (
            <LoanCard key={entry.loan.id} loan={toView(entry)} accounts={spendable} today={asOf} />
          ))}

          {closed.length > 0 ? (
            <>
              <h2 className="pt-2 text-[0.8125rem] font-medium text-ink-3">Finished</h2>
              {closed.map((entry) => (
                <LoanCard key={entry.loan.id} loan={toView(entry)} accounts={spendable} today={asOf} />
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-surface px-3.5 py-3">
      <p className="label">{label}</p>
      <p className={`mt-1 text-[1.0625rem] text-ink ${mono ? 'money' : ''}`}>{value}</p>
    </div>
  );
}
