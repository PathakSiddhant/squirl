'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { newId } from '@/lib/db/id';
import { debts, people, transactions } from '@/lib/db/schema';
import { fromZodError, debtInput, repaymentInput, type ActionResult } from '@/lib/validation';

import { closeSettledDebt } from './transactions';

function refreshAll() {
  revalidatePath('/', 'layout');
}

/** Opens a debt and records the movement that created it, in one step. */
export async function createDebt(input: z.input<typeof debtInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = debtInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const value = parsed.data;

  let personId = value.personId;
  if (!personId) {
    if (!value.newPersonName) return { ok: false, error: 'Who is this with?' };
    personId = newId('per');
    await db.insert(people).values({
      id: personId,
      name: value.newPersonName,
      handle: value.newPersonName.toLowerCase().split(/\s+/)[0],
    });
  }

  const debtId = newId('debt');
  await db.insert(debts).values({
    id: debtId,
    personId,
    direction: value.direction,
    openedOn: value.openedOn,
    dueOn: value.dueOn ?? null,
    interestKind: value.interestKind,
    // Percent per month arrives from the form and is stored as basis points,
    // so a rate never carries float dust into the interest engine.
    rateBpsPerMonth: Math.round(value.ratePctPerMonth * 100),
    status: 'open',
    note: value.note ?? null,
  });

  await db.insert(transactions).values({
    id: newId('txn'),
    day: value.openedOn,
    kind: value.direction === 'lent' ? 'lend' : 'borrow',
    amount: value.amount,
    accountId: value.accountId,
    personId,
    debtId,
    method: value.method,
    note: value.note ?? null,
  });

  refreshAll();
  return { ok: true, data: { id: debtId } };
}

/** Records money moving on an existing debt, in either direction. */
export async function recordRepayment(
  input: z.input<typeof repaymentInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = repaymentInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const value = parsed.data;

  const [debt] = await db.select().from(debts).where(eq(debts.id, value.debtId)).limit(1);
  if (!debt) return { ok: false, error: 'That debt no longer exists' };
  if (value.interestPart > value.amount) {
    return { ok: false, error: 'Interest cannot be more than the payment' };
  }

  const id = newId('txn');
  await db.insert(transactions).values({
    id,
    day: value.day,
    kind: debt.direction === 'lent' ? 'collect' : 'settle',
    amount: value.amount,
    interestPart: value.interestPart,
    accountId: value.accountId,
    personId: debt.personId,
    debtId: debt.id,
    method: value.method,
    note: value.note ?? null,
  });

  await closeSettledDebt(debt.id, value.day);
  refreshAll();
  return { ok: true, data: { id } };
}

/** Closes a debt by hand, for the ones that quietly stop being real. */
export async function closeDebt(
  debtId: string,
  outcome: 'settled' | 'written_off',
  day: string,
): Promise<ActionResult> {
  const [debt] = await db.select().from(debts).where(eq(debts.id, debtId)).limit(1);
  if (!debt) return { ok: false, error: 'That debt no longer exists' };

  await db.update(debts).set({ status: outcome, closedOn: day }).where(eq(debts.id, debtId));
  refreshAll();
  return { ok: true, data: undefined };
}

export async function reopenDebt(debtId: string): Promise<ActionResult> {
  await db.update(debts).set({ status: 'open', closedOn: null }).where(eq(debts.id, debtId));
  refreshAll();
  return { ok: true, data: undefined };
}

/**
 * Erases an agreement and every movement recorded against it.
 *
 * Distinct from writing it off. A write-off says "this happened and I am never
 * getting it back", and stays in the record because it is true. Deleting says
 * "this never happened", which is what you want after a mistake or a test
 * entry. Both need to exist, and neither can stand in for the other.
 */
export async function deleteDebt(debtId: string): Promise<ActionResult<{ removed: number }>> {
  const [debt] = await db.select().from(debts).where(eq(debts.id, debtId)).limit(1);
  if (!debt) return { ok: false, error: 'That agreement is already gone' };

  const movements = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.debtId, debtId));

  // transactions.debt_id cascades, so the movements go with the debt row and
  // the money they moved is removed from every balance at the same time.
  await db.delete(debts).where(eq(debts.id, debtId));

  refreshAll();
  return { ok: true, data: { removed: movements.length } };
}

/** What deleting a person would take with them, so the warning is specific. */
export async function personImpact(
  personId: string,
): Promise<{ name: string; debts: number; movements: number }> {
  const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  const theirDebts = await db.select({ id: debts.id }).from(debts).where(eq(debts.personId, personId));
  const movements = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.personId, personId));

  return {
    name: person?.name ?? 'Unknown',
    debts: theirDebts.length,
    movements: movements.length,
  };
}

/**
 * Removes a person and everything that only existed because of them.
 *
 * Their agreements cascade, and so do the movements on those agreements.
 * Movements that merely mention them, like a repayment logged loosely, keep
 * their money but lose the name, because deleting real money to tidy up a
 * contact list would be the wrong trade.
 */
export async function deletePerson(personId: string): Promise<ActionResult> {
  const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!person) return { ok: false, error: 'That person is already gone' };

  await db.delete(people).where(eq(people.id, personId));
  refreshAll();
  return { ok: true, data: undefined };
}

/** Hides someone without touching the history. The reversible option. */
export async function archivePerson(personId: string): Promise<ActionResult> {
  await db.update(people).set({ archivedAt: Date.now() }).where(eq(people.id, personId));
  refreshAll();
  return { ok: true, data: undefined };
}

export async function restorePerson(personId: string): Promise<ActionResult> {
  await db.update(people).set({ archivedAt: null }).where(eq(people.id, personId));
  refreshAll();
  return { ok: true, data: undefined };
}

const personInput = z.object({
  name: z.string().trim().min(1, 'Give them a name').max(60),
  handle: z.string().trim().max(30).nullable().optional(),
  note: z.string().max(200).nullable().optional(),
});

export async function createPerson(input: z.input<typeof personInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = personInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const id = newId('per');
  await db.insert(people).values({
    id,
    name: parsed.data.name,
    handle: parsed.data.handle || parsed.data.name.toLowerCase().split(/\s+/)[0],
    note: parsed.data.note ?? null,
  });

  refreshAll();
  return { ok: true, data: { id } };
}
