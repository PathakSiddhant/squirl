'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { today as istToday } from '@/lib/date';
import { db } from '@/lib/db/client';
import { newId } from '@/lib/db/id';
import {
  accounts,
  categories,
  debts,
  installments,
  loans,
  people,
  reconciliations,
  recurring,
  settings,
  transactions,
} from '@/lib/db/schema';
import { accountBalances } from '@/lib/domain/position';
import { getMovements } from '@/lib/queries/ledger';
import { getAllAccounts } from '@/lib/queries/reference';
import {
  accountInput,
  fromZodError,
  preferencesInput,
  reconcileInput,
  type ActionResult,
} from '@/lib/validation';

function refreshAll() {
  revalidatePath('/', 'layout');
}

export async function createAccount(input: z.input<typeof accountInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = accountInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const existing = await getAllAccounts();
  const id = newId('acc');

  await db.insert(accounts).values({
    id,
    name: parsed.data.name,
    kind: parsed.data.kind,
    openingBalance: parsed.data.openingBalance,
    note: parsed.data.note ?? null,
    sortOrder: existing.length,
  });

  refreshAll();
  return { ok: true, data: { id } };
}

export async function archiveAccount(id: string): Promise<ActionResult> {
  await db.update(accounts).set({ archivedAt: Date.now() }).where(eq(accounts.id, id));
  refreshAll();
  return { ok: true, data: undefined };
}

export async function restoreAccount(id: string): Promise<ActionResult> {
  await db.update(accounts).set({ archivedAt: null }).where(eq(accounts.id, id));
  refreshAll();
  return { ok: true, data: undefined };
}

/**
 * The honesty mechanism.
 *
 * You open your banking app, type what it actually says, and the gap becomes a
 * real adjustment row with a reason attached. This is what closes the loop on
 * "sometimes I have 1000 and sometimes 0 and I do not know why": the untracked
 * money gets a name instead of quietly corrupting every number above it.
 */
export async function reconcileAccount(
  input: z.input<typeof reconcileInput>,
): Promise<ActionResult<{ difference: number }>> {
  const parsed = reconcileInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const value = parsed.data;

  const [accountRows, movements] = await Promise.all([getAllAccounts(), getMovements(undefined, value.day)]);
  const account = accountRows.find((a) => a.id === value.accountId);
  if (!account) return { ok: false, error: 'That account no longer exists' };

  const balances = accountBalances(
    accountRows.map((a) => ({ id: a.id, kind: a.kind, openingBalance: a.openingBalance })),
    movements,
    value.day,
  );

  const expected = balances.get(value.accountId) ?? 0;
  const difference = value.actualBalance - expected;

  let transactionId: string | null = null;
  if (difference !== 0) {
    transactionId = newId('txn');
    await db.insert(transactions).values({
      id: transactionId,
      day: value.day,
      kind: difference > 0 ? 'adjust_up' : 'adjust_down',
      amount: Math.abs(difference),
      accountId: value.accountId,
      method: 'other',
      note: value.note || (difference > 0 ? 'Untracked money found' : 'Untracked spending'),
    });
  }

  await db.insert(reconciliations).values({
    id: newId('rcn'),
    accountId: value.accountId,
    day: value.day,
    expectedBalance: expected,
    actualBalance: value.actualBalance,
    difference,
    transactionId,
    note: value.note ?? null,
  });

  refreshAll();
  return { ok: true, data: { difference } };
}

export async function savePreferences(
  input: z.input<typeof preferencesInput>,
): Promise<ActionResult> {
  const parsed = preferencesInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const entries = Object.entries(parsed.data);
  for (const [key, value] of entries) {
    await db
      .insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value), updatedAt: Date.now() } });
  }

  refreshAll();
  return { ok: true, data: undefined };
}

/** A full JSON snapshot. Your data, in a file you own. */
export async function exportLedger(): Promise<string> {
  const [
    accountRows,
    categoryRows,
    peopleRows,
    debtRows,
    loanRows,
    installmentRows,
    transactionRows,
    recurringRows,
    settingRows,
  ] = await Promise.all([
    db.select().from(accounts),
    db.select().from(categories),
    db.select().from(people),
    db.select().from(debts),
    db.select().from(loans),
    db.select().from(installments),
    db.select().from(transactions),
    db.select().from(recurring),
    db.select().from(settings),
  ]);

  return JSON.stringify(
    {
      app: 'squirl',
      version: 1,
      exportedOn: istToday(),
      accounts: accountRows,
      categories: categoryRows,
      people: peopleRows,
      debts: debtRows,
      loans: loanRows,
      installments: installmentRows,
      transactions: transactionRows,
      recurring: recurringRows,
      settings: settingRows,
    },
    null,
    2,
  );
}
