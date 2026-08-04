'use client';

import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createLoan } from '@/app/actions/loans';
import { addMonths, formatDay, type DayString } from '@/lib/date';
import { buildSchedule, effectiveAnnualRatePct, scheduleTotals } from '@/lib/domain/loans';
import { formatMoney, parseAmount } from '@/lib/money';

import { Button } from '../ui/button';
import { Field, Input } from '../ui/primitives';

/**
 * Adding a loan.
 *
 * Defaults to the way these products are actually sold: you were told a
 * monthly number and a count of months, not a rate. The preview then tells you
 * what that really costs before you commit it, which is information the lender
 * did not volunteer.
 */
export function NewLoanForm({
  accounts,
  today,
}: {
  accounts: Array<{ id: string; name: string }>;
  today: DayString;
}) {
  const [open, setOpen] = useState(false);
  const [lender, setLender] = useState('');
  const [principal, setPrincipal] = useState('');
  const [tenure, setTenure] = useState('3');
  const [emi, setEmi] = useState('');
  const [firstDueOn, setFirstDueOn] = useState<string>(addMonths(today, 1));
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    const p = parseAmount(principal);
    const e = parseAmount(emi);
    const months = Number(tenure);
    if (!p || !e || !months || months < 1) return null;

    const schedule = buildSchedule({
      principal: p,
      tenureMonths: months,
      firstDueOn,
      interestModel: 'emi_known',
      emiAmount: e,
    });

    return {
      totals: scheduleTotals(schedule),
      apr: effectiveAnnualRatePct(p, e, months),
      last: schedule[schedule.length - 1]?.dueOn,
    };
  }, [principal, emi, tenure, firstDueOn]);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus size={14} weight="bold" />
        Add a loan
      </Button>
    );
  }

  const submit = () => {
    const p = parseAmount(principal);
    const e = parseAmount(emi);
    const months = Number(tenure);

    if (!lender.trim()) return toast.error('Who lent it to you?');
    if (!p || p <= 0) return toast.error('Enter how much you borrowed');
    if (!e || e <= 0) return toast.error('Enter the monthly installment');
    if (!months || months < 1) return toast.error('Enter how many months');

    startTransition(async () => {
      const result = await createLoan({
        lender: lender.trim(),
        principal: p,
        takenOn: today,
        tenureMonths: months,
        interestModel: 'emi_known',
        emiAmount: e,
        ratePctPerAnnum: 0,
        processingFee: 0,
        firstDueOn,
        accountId,
        recordDisbursal: true,
      });

      if (result.ok) {
        toast.success('Loan added, schedule built');
        setOpen(false);
        setLender('');
        setPrincipal('');
        setEmi('');
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Who lent it">
          <Input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="App or person" />
        </Field>
        <Field label="How much you got">
          <Input
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            inputMode="decimal"
            placeholder="1500"
          />
        </Field>
        <Field label="Monthly installment" hint="The number they quoted you">
          <Input value={emi} onChange={(e) => setEmi(e.target.value)} inputMode="decimal" placeholder="550" />
        </Field>
        <Field label="For how many months">
          <Input value={tenure} onChange={(e) => setTenure(e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="First payment due">
          <Input type="date" value={firstDueOn} onChange={(e) => setFirstDueOn(e.target.value)} />
        </Field>
        <Field label="Money landed in">
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
      </div>

      {preview ? (
        <div className="mt-4 rounded-sm border border-line bg-surface-2 px-3 py-2.5">
          <p className="text-[0.8125rem] text-ink-2">
            You will pay back{' '}
            <span className="money text-ink">{formatMoney(preview.totals.total)}</span> in total, so the
            loan costs <span className="money text-ink">{formatMoney(preview.totals.interest)}</span>
            {preview.last ? <> and finishes on {formatDay(preview.last, today)}</> : null}.
          </p>
          {preview.apr !== null && preview.apr > 0 ? (
            <p className="mt-1 text-[0.8125rem] text-ink-3">
              That is an effective{' '}
              <span className={preview.apr > 36 ? 'text-[var(--i-owe-text)]' : 'text-ink-2'}>
                {preview.apr.toFixed(0)}% a year
              </span>
              , because the amount you owe shrinks while the payment does not.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Button variant="primary" onClick={submit} disabled={pending}>
          Add loan
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
