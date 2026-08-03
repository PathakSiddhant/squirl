import { asc, eq } from 'drizzle-orm';

import type { DayString } from '../date';
import { db } from '../db/client';
import { installments, loans, type Installment, type Loan } from '../db/schema';
import { effectiveAnnualRatePct } from '../domain/loans';
import { sum } from '../money';

export interface LoanWithSchedule {
  loan: Loan;
  schedule: Installment[];
  paidCount: number;
  /** Principal still owed. This is the liability that hits net worth. */
  principalOutstanding: number;
  /** Everything still to be handed over, interest included. */
  remainingTotal: number;
  totalInterest: number;
  nextDue: Installment | null;
  overdue: Installment[];
  /** What the loan really costs per year, solved from the schedule. */
  effectiveApr: number | null;
  progress: number;
}

export async function getLoansWithSchedules(asOf: DayString): Promise<LoanWithSchedule[]> {
  const [loanRows, installmentRows] = await Promise.all([
    db.select().from(loans).orderBy(asc(loans.takenOn)),
    db.select().from(installments).orderBy(asc(installments.dueOn)),
  ]);

  const byLoan = new Map<string, Installment[]>();
  for (const row of installmentRows) {
    const list = byLoan.get(row.loanId) ?? [];
    list.push(row);
    byLoan.set(row.loanId, list);
  }

  return loanRows.map((loan) => {
    const schedule = byLoan.get(loan.id) ?? [];
    const unpaid = schedule.filter((i) => i.status === 'due');
    const paid = schedule.filter((i) => i.status === 'paid');

    return {
      loan,
      schedule,
      paidCount: paid.length,
      principalOutstanding: sum(unpaid.map((i) => i.principalPart)),
      remainingTotal: sum(unpaid.map((i) => i.amount)),
      totalInterest: sum(schedule.map((i) => i.interestPart)),
      nextDue: unpaid[0] ?? null,
      overdue: unpaid.filter((i) => i.dueOn < asOf),
      effectiveApr: effectiveAnnualRatePct(
        loan.principal,
        schedule[0]?.amount ?? loan.emiAmount,
        loan.tenureMonths,
      ),
      progress: schedule.length === 0 ? 0 : paid.length / schedule.length,
    };
  });
}

export async function getLoan(id: string) {
  const [loan] = await db.select().from(loans).where(eq(loans.id, id)).limit(1);
  if (!loan) return null;
  const schedule = await db
    .select()
    .from(installments)
    .where(eq(installments.loanId, id))
    .orderBy(asc(installments.seq));
  return { loan, schedule };
}

export function activeLoans(entries: LoanWithSchedule[]): LoanWithSchedule[] {
  return entries.filter((e) => e.loan.status === 'active');
}
