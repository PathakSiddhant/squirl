'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { newId } from '@/lib/db/id';
import { installments, loans, transactions } from '@/lib/db/schema';
import { buildSchedule } from '@/lib/domain/loans';
import { fromZodError, loanInput, type ActionResult } from '@/lib/validation';

function refreshAll() {
  revalidatePath('/', 'layout');
}

/** Creates a loan and materialises its whole installment schedule up front. */
export async function createLoan(input: z.input<typeof loanInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = loanInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const value = parsed.data;

  const schedule = buildSchedule({
    principal: value.principal,
    tenureMonths: value.tenureMonths,
    firstDueOn: value.firstDueOn,
    interestModel: value.interestModel,
    emiAmount: value.emiAmount,
    rateBpsPerAnnum: Math.round(value.ratePctPerAnnum * 100),
  });

  if (schedule.length === 0) return { ok: false, error: 'That does not make a valid schedule' };

  const loanId = newId('loan');
  await db.insert(loans).values({
    id: loanId,
    lender: value.lender,
    principal: value.principal,
    takenOn: value.takenOn,
    tenureMonths: value.tenureMonths,
    interestModel: value.interestModel,
    rateBpsPerAnnum: Math.round(value.ratePctPerAnnum * 100),
    emiAmount: value.emiAmount,
    processingFee: value.processingFee,
    firstDueOn: value.firstDueOn,
    status: 'active',
    note: value.note ?? null,
  });

  await db.insert(installments).values(
    schedule.map((item) => ({
      id: newId('inst'),
      loanId,
      seq: item.seq,
      dueOn: item.dueOn,
      amount: item.amount,
      principalPart: item.principalPart,
      interestPart: item.interestPart,
      status: 'due' as const,
    })),
  );

  // Some loans pay a merchant directly and the cash never reaches you. In that
  // case the liability is real but there is no inflow to record.
  if (value.recordDisbursal) {
    await db.insert(transactions).values({
      id: newId('txn'),
      day: value.takenOn,
      kind: 'loan_taken',
      amount: value.principal - value.processingFee,
      accountId: value.accountId,
      loanId,
      method: 'bank',
      note: value.processingFee > 0 ? 'Disbursed, after processing fee' : 'Disbursed',
    });
  }

  refreshAll();
  return { ok: true, data: { id: loanId } };
}

/** Marks an installment paid and records the money leaving. */
export async function payInstallment(
  installmentId: string,
  day: string,
  accountId: string,
): Promise<ActionResult> {
  const [item] = await db.select().from(installments).where(eq(installments.id, installmentId)).limit(1);
  if (!item) return { ok: false, error: 'That installment no longer exists' };
  if (item.status === 'paid') return { ok: false, error: 'Already marked paid' };

  await db.insert(transactions).values({
    id: newId('txn'),
    day,
    kind: 'loan_payment',
    amount: item.amount,
    interestPart: item.interestPart,
    accountId,
    loanId: item.loanId,
    installmentId: item.id,
    method: 'auto',
    note: `EMI ${item.seq}`,
  });

  await db
    .update(installments)
    .set({ status: 'paid', paidOn: day })
    .where(eq(installments.id, installmentId));

  // Close the loan once nothing is left outstanding.
  const remaining = await db
    .select({ id: installments.id })
    .from(installments)
    .where(and(eq(installments.loanId, item.loanId), eq(installments.status, 'due')));

  if (remaining.length === 0) {
    await db.update(loans).set({ status: 'closed', closedOn: day }).where(eq(loans.id, item.loanId));
  }

  refreshAll();
  return { ok: true, data: undefined };
}

export async function deleteLoan(loanId: string): Promise<ActionResult> {
  // Transactions and installments cascade from the loan row.
  await db.delete(loans).where(eq(loans.id, loanId));
  refreshAll();
  return { ok: true, data: undefined };
}

/**
 * Edits a loan's terms and rebuilds its schedule.
 *
 * Whatever has already been paid is left alone: those installments are
 * historical fact, not a plan that can be rewritten. Only the still-due tail
 * is regenerated, so fixing a typo in the principal never touches a payment
 * you already made. Reducing the tenure below what is already paid is refused
 * outright, since there would be nothing left to apply the new terms to.
 */
export async function updateLoan(
  loanId: string,
  input: z.input<typeof loanInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = loanInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const value = parsed.data;

  const [loan] = await db.select().from(loans).where(eq(loans.id, loanId)).limit(1);
  if (!loan) return { ok: false, error: 'That loan no longer exists' };

  const existing = await db
    .select()
    .from(installments)
    .where(eq(installments.loanId, loanId))
    .orderBy(installments.seq);
  const paid = existing.filter((i) => i.status === 'paid');

  if (value.tenureMonths < paid.length) {
    return {
      ok: false,
      error: `Already paid ${paid.length} of these. Cannot shorten below that.`,
    };
  }

  const schedule = buildSchedule({
    principal: value.principal,
    tenureMonths: value.tenureMonths,
    firstDueOn: value.firstDueOn,
    interestModel: value.interestModel,
    emiAmount: value.emiAmount,
    rateBpsPerAnnum: Math.round(value.ratePctPerAnnum * 100),
  });
  if (schedule.length === 0) return { ok: false, error: 'That does not make a valid schedule' };

  const remaining = schedule.slice(paid.length);

  await db
    .delete(installments)
    .where(and(eq(installments.loanId, loanId), eq(installments.status, 'due')));
  await db.insert(installments).values(
    remaining.map((item) => ({
      id: newId('inst'),
      loanId,
      seq: item.seq,
      dueOn: item.dueOn,
      amount: item.amount,
      principalPart: item.principalPart,
      interestPart: item.interestPart,
      status: 'due' as const,
    })),
  );

  await db
    .update(loans)
    .set({
      lender: value.lender,
      principal: value.principal,
      tenureMonths: value.tenureMonths,
      interestModel: value.interestModel,
      rateBpsPerAnnum: Math.round(value.ratePctPerAnnum * 100),
      emiAmount: value.emiAmount,
      processingFee: value.processingFee,
      firstDueOn: value.firstDueOn,
      note: value.note ?? null,
      // Re-editing an already-finished loan reopens it; the new tail is unpaid.
      status: 'active',
      closedOn: null,
    })
    .where(eq(loans.id, loanId));

  // The disbursal record should track the corrected principal, so a typo
  // there does not go on quietly overstating a real account balance.
  await db
    .update(transactions)
    .set({ amount: value.principal - value.processingFee, updatedAt: Date.now() })
    .where(and(eq(transactions.loanId, loanId), eq(transactions.kind, 'loan_taken')));

  refreshAll();
  return { ok: true, data: { id: loanId } };
}
