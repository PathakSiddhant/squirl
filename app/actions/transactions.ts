'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { today } from '@/lib/date';
import { db } from '@/lib/db/client';
import { newId } from '@/lib/db/id';
import { debts, installments, people, transactions } from '@/lib/db/schema';
import { intendedDestination, parseCapture } from '@/lib/domain/capture';
import { computeDebtPosition, splitRepayment } from '@/lib/domain/interest';
import { getCaptureContext } from '@/lib/queries/reference';
import { getDebtMovements } from '@/lib/queries/ledger';
import { fromZodError, transactionInput, type ActionResult, type TransactionInput } from '@/lib/validation';

/** Refresh everything. The whole app is derived from one ledger, so one page
 *  cannot change without potentially changing the rest. */
function refreshAll() {
  revalidatePath('/', 'layout');
}

export async function createTransaction(input: TransactionInput): Promise<ActionResult<{ id: string }>> {
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const id = newId('txn');
  await db.insert(transactions).values({ id, ...parsed.data });

  refreshAll();
  return { ok: true, data: { id } };
}

/**
 * The quick-capture path: one line of text in, one ledger row out.
 *
 * A person named but not known yet is created here rather than blocking the
 * capture, because stopping to make a contact is exactly the friction that
 * stops things being logged at all.
 */
export async function captureTransaction(raw: string): Promise<ActionResult<{ id: string; summary: string }>> {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'Type something first' };

  const context = await getCaptureContext();
  const parsed = parseCapture(text, { today: today(), ...context });

  if (!parsed.ok || !parsed.amount) {
    return { ok: false, error: 'No amount found. Try something like "chai 20".' };
  }

  let personId = parsed.personId;
  if (!personId && parsed.newPersonName) {
    personId = newId('per');
    await db.insert(people).values({
      id: personId,
      name: parsed.newPersonName,
      handle: parsed.newPersonName.toLowerCase(),
    });
  }

  // Money has to come from or land in an account. Fall back to the first one.
  const fallbackAccount =
    context.accounts.find((a) => a.kind === 'bank')?.id ?? context.accounts[0]?.id ?? null;
  const accountId = parsed.accountId ?? fallbackAccount;
  if (!accountId) return { ok: false, error: 'Add an account first' };

  const counterAccountId = parsed.counterAccountId;
  if (parsed.kind === 'transfer') {
    if (!counterAccountId) {
      // Name the actual problem. "Say where the money went" is maddening when
      // you plainly did; the account simply does not exist yet.
      const wanted = intendedDestination(text);
      const names = context.accounts.map((a) => a.name).join(', ');
      return {
        ok: false,
        error: wanted
          ? `There is no account called "${wanted}". Create it on the Accounts page, then try again. You have: ${names}.`
          : `Say which account it went into. You have: ${names}.`,
      };
    }
    if (counterAccountId === accountId) {
      return { ok: false, error: 'That is the same account on both sides. Pick a different destination.' };
    }
  }

  // Lending and borrowing open a debt so the money stays tracked as a position.
  let debtId: string | null = null;
  if (parsed.kind === 'lend' || parsed.kind === 'borrow') {
    if (!personId) return { ok: false, error: 'Say who, e.g. "lent 500 to rahul"' };
    debtId = newId('debt');
    await db.insert(debts).values({
      id: debtId,
      personId,
      direction: parsed.kind === 'lend' ? 'lent' : 'borrowed',
      openedOn: parsed.day,
      interestKind: 'none',
      rateBpsPerMonth: 0,
      status: 'open',
    });
  }

  // A repayment attaches to the oldest open debt with that person, and its
  // interest slice is computed from the terms rather than guessed.
  let interestPart = 0;
  if (parsed.kind === 'collect' || parsed.kind === 'settle') {
    if (!personId) return { ok: false, error: 'Say who, e.g. "rahul paid back 500"' };
    const direction = parsed.kind === 'collect' ? 'lent' : 'borrowed';
    const open = await db
      .select()
      .from(debts)
      .where(eq(debts.personId, personId))
      .orderBy(debts.openedOn);
    const target = open.find((d) => d.direction === direction && d.status === 'open');
    if (!target) {
      return { ok: false, error: `No open ${direction === 'lent' ? 'loan to' : 'debt with'} that person` };
    }
    debtId = target.id;

    const events = await getDebtMovements(target.id);
    const position = computeDebtPosition(
      { openedOn: target.openedOn, interestKind: target.interestKind, rateBpsPerMonth: target.rateBpsPerMonth },
      events.map((e) =>
        e.kind === 'lend' || e.kind === 'borrow'
          ? ({ type: 'principal', day: e.day, amount: e.amount } as const)
          : ({ type: 'repayment', day: e.day, amount: e.amount, interestPart: e.interestPart } as const),
      ),
      parsed.day,
    );
    interestPart = splitRepayment(position, parsed.amount).interestPart;
  }

  const result = await createTransaction({
    day: parsed.day,
    kind: parsed.kind,
    amount: parsed.amount,
    accountId,
    counterAccountId: parsed.kind === 'transfer' ? counterAccountId : null,
    categoryId: parsed.categoryId,
    personId,
    debtId,
    loanId: null,
    installmentId: null,
    interestPart,
    method: parsed.method,
    note: parsed.note || null,
    rawInput: text,
  });

  if (!result.ok) return result;

  await closeSettledDebt(debtId, parsed.day);

  return { ok: true, data: { id: result.data.id, summary: text } };
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  await db
    .update(transactions)
    .set({ ...parsed.data, updatedAt: Date.now() })
    .where(eq(transactions.id, id));

  refreshAll();
  return { ok: true, data: { id } };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!row) return { ok: false, error: 'That entry is already gone' };

  // Deleting an EMI payment has to release the installment, or the loan would
  // still look paid while the money is back in the account.
  if (row.installmentId) {
    await db
      .update(installments)
      .set({ status: 'due', paidOn: null })
      .where(eq(installments.id, row.installmentId));
  }

  await db.delete(transactions).where(eq(transactions.id, id));
  refreshAll();
  return { ok: true, data: undefined };
}

/** Marks a debt settled once nothing is left on it. */
export async function closeSettledDebt(debtId: string | null, asOf: string): Promise<void> {
  if (!debtId) return;

  const [debt] = await db.select().from(debts).where(eq(debts.id, debtId)).limit(1);
  if (!debt || debt.status !== 'open') return;

  const events = await getDebtMovements(debtId);
  const position = computeDebtPosition(
    { openedOn: debt.openedOn, interestKind: debt.interestKind, rateBpsPerMonth: debt.rateBpsPerMonth },
    events.map((e) =>
      e.kind === 'lend' || e.kind === 'borrow'
        ? ({ type: 'principal', day: e.day, amount: e.amount } as const)
        : ({ type: 'repayment', day: e.day, amount: e.amount, interestPart: e.interestPart } as const),
    ),
    asOf,
  );

  if (position.isCleared && position.principalAdvanced > 0) {
    await db.update(debts).set({ status: 'settled', closedOn: asOf }).where(eq(debts.id, debtId));
    refreshAll();
  }
}
