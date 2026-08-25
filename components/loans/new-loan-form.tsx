'use client';

import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { X } from '@phosphor-icons/react/dist/csr/X';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createLoan, updateLoan } from '@/app/actions/loans';
import { cn } from '@/lib/cn';
import { addMonths, formatDay, today as istToday, type DayString } from '@/lib/date';
import { buildSchedule, effectiveAnnualRatePct, scheduleTotals } from '@/lib/domain/loans';
import { formatMoney, parseAmount, toRupees } from '@/lib/money';

import { Button } from '../ui/button';
import { Field, Input } from '../ui/primitives';

export interface LoanEditable {
  id: string;
  lender: string;
  principal: number;
  tenureMonths: number;
  emiAmount: number;
  firstDueOn: DayString;
  takenOn: DayString;
  note: string | null;
  paidCount: number;
}

/**
 * Adding or editing a loan.
 *
 * Defaults to the way these products are actually sold: you were told a
 * monthly number and a count of months, not a rate. The preview then tells you
 * what that really costs before you commit it, which is information the lender
 * did not volunteer.
 *
 * On an edit, only the still-due installments are ever touched. Anything
 * already paid is left exactly as it was, so fixing a typo can never rewrite
 * a payment that already happened.
 */
export function LoanForm({
  existing,
  accounts,
  today,
  open,
  onOpenChange,
}: {
  existing: LoanEditable | null;
  accounts: Array<{ id: string; name: string }>;
  today: DayString;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isNew = existing === null;
  const [lender, setLender] = useState('');
  const [principal, setPrincipal] = useState('');
  const [tenure, setTenure] = useState('3');
  const [emi, setEmi] = useState('');
  const [firstDueOn, setFirstDueOn] = useState<string>(addMonths(today, 1));
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLender(existing?.lender ?? '');
    setPrincipal(existing ? String(toRupees(existing.principal)) : '');
    setTenure(existing ? String(existing.tenureMonths) : '3');
    setEmi(existing ? String(toRupees(existing.emiAmount)) : '');
    setFirstDueOn(existing?.firstDueOn ?? addMonths(today, 1));
    setAccountId(accounts[0]?.id ?? '');
  }, [open, existing, accounts, today]);

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

  const submit = () => {
    const p = parseAmount(principal);
    const e = parseAmount(emi);
    const months = Number(tenure);

    if (!lender.trim()) return toast.error('Who lent it to you?');
    if (!p || p <= 0) return toast.error('Enter how much you borrowed');
    if (!e || e <= 0) return toast.error('Enter the monthly installment');
    if (!months || months < 1) return toast.error('Enter how many months');
    if (existing && months < existing.paidCount) {
      return toast.error(`Already paid ${existing.paidCount} of these, cannot go below that`);
    }

    const payload = {
      lender: lender.trim(),
      principal: p,
      takenOn: existing?.takenOn ?? today,
      tenureMonths: months,
      interestModel: 'emi_known' as const,
      emiAmount: e,
      ratePctPerAnnum: 0,
      processingFee: 0,
      firstDueOn,
      accountId,
      recordDisbursal: true,
      note: null,
    };

    startTransition(async () => {
      const result = isNew ? await createLoan(payload) : await updateLoan(existing.id, payload);
      if (result.ok) {
        toast.success(isNew ? 'Loan added, schedule built' : 'Saved, the plan ahead is rebuilt');
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay fixed inset-0 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'z-modal fixed left-1/2 top-1/2 max-h-[88dvh] w-[calc(100vw-2rem)] max-w-[480px]',
            '-translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-surface',
            'shadow-[var(--shadow-pop)] focus:outline-none',
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Dialog.Title className="text-[0.9375rem] font-semibold text-ink">
              {isNew ? 'Add a loan' : `Edit ${existing.lender}`}
            </Dialog.Title>
            <Dialog.Close className="rounded-sm p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink">
              <X size={15} />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="space-y-3 px-4 py-4">
            {existing && existing.paidCount > 0 ? (
              <p className="rounded-sm border border-line bg-surface-2 px-3 py-2 text-[0.8125rem] text-ink-2">
                {existing.paidCount} installment{existing.paidCount === 1 ? ' is' : 's are'} already
                marked paid and will not change. Only what is still due gets rebuilt from these
                terms.
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Who lent it">
                <Input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="App or person" autoFocus />
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
              <Field label={isNew ? 'First payment due' : 'Next payment due'}>
                <Input type="date" value={firstDueOn} onChange={(e) => setFirstDueOn(e.target.value)} />
              </Field>
              {isNew ? (
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
              ) : null}
            </div>

            {preview ? (
              <div className="rounded-sm border border-line bg-surface-2 px-3 py-2.5">
                <p className="text-[0.8125rem] text-ink-2">
                  You will pay back{' '}
                  <span className="money text-ink">{formatMoney(preview.totals.total)}</span> in
                  total, so the loan costs{' '}
                  <span className="money text-ink">{formatMoney(preview.totals.interest)}</span>
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
                ) : (
                  <p className="mt-1 text-[0.8125rem] text-ink-3">
                    That works out to no interest at all, since the installments add up to exactly
                    what you borrowed.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submit} disabled={pending}>
              {isNew ? 'Add loan' : 'Save'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AddLoanButton({
  accounts,
  today,
}: {
  accounts: Array<{ id: string; name: string }>;
  today?: DayString;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus size={14} weight="bold" />
        Add a loan
      </Button>
      <LoanForm existing={null} accounts={accounts} today={today ?? istToday()} open={open} onOpenChange={setOpen} />
    </>
  );
}
