'use server';

import { and, eq, lte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { today as istToday, type DayString } from '@/lib/date';
import { db } from '@/lib/db/client';
import { newId } from '@/lib/db/id';
import { INTERVAL_UNITS, recurring, transactions, type Recurring } from '@/lib/db/schema';
import { duePostings, nextDueOn } from '@/lib/domain/recurring';
import { dayField, fromZodError, PAYMENT_METHOD_ENUM, type ActionResult } from '@/lib/validation';

function refreshAll() {
  revalidatePath('/', 'layout');
}

const recurringInput = z
  .object({
    name: z.string().trim().min(1, 'Give it a name').max(60),
    kind: z.enum(['expense', 'income', 'transfer']),
    amount: z.number().int().positive('Amount has to be more than zero'),
    accountId: z.string().min(1, 'Pick an account'),
    counterAccountId: z.string().min(1).nullable().optional(),
    categoryId: z.string().min(1).nullable().optional(),
    intervalUnit: z.enum(INTERVAL_UNITS),
    intervalCount: z.number().int().min(1).max(365),
    startsOn: dayField,
    endsOn: dayField.nullable().optional(),
    autoPost: z.boolean().default(false),
    method: PAYMENT_METHOD_ENUM.default('auto'),
    note: z.string().max(200).nullable().optional(),
  })
  .refine((v) => v.kind !== 'transfer' || v.counterAccountId, {
    message: 'A transfer needs somewhere to go',
    path: ['counterAccountId'],
  })
  .refine((v) => v.kind !== 'transfer' || v.counterAccountId !== v.accountId, {
    message: 'Pick two different accounts',
    path: ['counterAccountId'],
  })
  .refine((v) => !v.endsOn || v.endsOn >= v.startsOn, {
    message: 'The end date cannot be before the start',
    path: ['endsOn'],
  });

export type RecurringInput = z.input<typeof recurringInput>;

export async function createRecurring(input: RecurringInput): Promise<ActionResult<{ id: string }>> {
  const parsed = recurringInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const v = parsed.data;

  const id = newId('rec');
  await db.insert(recurring).values({
    id,
    name: v.name,
    kind: v.kind,
    amount: v.amount,
    accountId: v.accountId,
    counterAccountId: v.kind === 'transfer' ? (v.counterAccountId ?? null) : null,
    categoryId: v.kind === 'transfer' ? null : (v.categoryId ?? null),
    intervalUnit: v.intervalUnit,
    intervalCount: v.intervalCount,
    startsOn: v.startsOn,
    endsOn: v.endsOn ?? null,
    postedCount: 0,
    nextDueOn: v.startsOn,
    autoPost: v.autoPost,
    method: v.method,
    active: true,
    note: v.note ?? null,
  });

  refreshAll();
  return { ok: true, data: { id } };
}

export async function updateRecurring(
  id: string,
  input: RecurringInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = recurringInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const v = parsed.data;

  const [existing] = await db.select().from(recurring).where(eq(recurring.id, id)).limit(1);
  if (!existing) return { ok: false, error: 'That one no longer exists' };

  // Changing the schedule re-derives the pointer from what has already posted,
  // so editing an amount never silently re-charges past months.
  const schedule = {
    startsOn: v.startsOn,
    intervalUnit: v.intervalUnit,
    intervalCount: v.intervalCount,
    endsOn: v.endsOn ?? null,
  };

  await db
    .update(recurring)
    .set({
      name: v.name,
      kind: v.kind,
      amount: v.amount,
      accountId: v.accountId,
      counterAccountId: v.kind === 'transfer' ? (v.counterAccountId ?? null) : null,
      categoryId: v.kind === 'transfer' ? null : (v.categoryId ?? null),
      intervalUnit: v.intervalUnit,
      intervalCount: v.intervalCount,
      startsOn: v.startsOn,
      endsOn: v.endsOn ?? null,
      nextDueOn: nextDueOn(schedule, existing.postedCount) ?? v.startsOn,
      autoPost: v.autoPost,
      method: v.method,
      note: v.note ?? null,
    })
    .where(eq(recurring.id, id));

  refreshAll();
  return { ok: true, data: { id } };
}

export async function setRecurringActive(id: string, active: boolean): Promise<ActionResult> {
  await db.update(recurring).set({ active }).where(eq(recurring.id, id));
  refreshAll();
  return { ok: true, data: undefined };
}

/**
 * Deletes the rule but keeps every charge it already posted.
 *
 * Cancelling Netflix does not mean you never paid for Netflix. The history is
 * real money that really left, so it stays; only the future stops.
 */
export async function deleteRecurring(id: string): Promise<ActionResult> {
  await db.delete(recurring).where(eq(recurring.id, id));
  refreshAll();
  return { ok: true, data: undefined };
}

/** Writes one occurrence of a rule into the ledger. */
function rowFor(rule: Recurring, day: DayString) {
  return {
    id: newId('txn'),
    day,
    kind: rule.kind,
    amount: rule.amount,
    accountId: rule.accountId,
    counterAccountId: rule.kind === 'transfer' ? rule.counterAccountId : null,
    categoryId: rule.kind === 'transfer' ? null : rule.categoryId,
    method: rule.method,
    note: rule.name,
  };
}

async function post(rule: Recurring, days: DayString[]): Promise<number> {
  if (days.length === 0) return 0;

  await db.insert(transactions).values(days.map((day) => rowFor(rule, day)));

  const postedCount = rule.postedCount + days.length;
  const schedule = {
    startsOn: rule.startsOn,
    intervalUnit: rule.intervalUnit,
    intervalCount: rule.intervalCount,
    endsOn: rule.endsOn,
  };

  await db
    .update(recurring)
    .set({
      postedCount,
      lastPostedOn: days[days.length - 1],
      nextDueOn: nextDueOn(schedule, postedCount) ?? rule.nextDueOn,
      active: nextDueOn(schedule, postedCount) !== null,
    })
    .where(eq(recurring.id, rule.id));

  return days.length;
}

/** Posts one rule on demand, for the confirm button on a reminder. */
export async function postRecurringNow(
  id: string,
  asOf: DayString = istToday(),
): Promise<ActionResult<{ posted: number }>> {
  const [rule] = await db.select().from(recurring).where(eq(recurring.id, id)).limit(1);
  if (!rule) return { ok: false, error: 'That one no longer exists' };

  const due = duePostings(
    {
      startsOn: rule.startsOn,
      intervalUnit: rule.intervalUnit,
      intervalCount: rule.intervalCount,
      endsOn: rule.endsOn,
    },
    rule.postedCount,
    asOf,
  );

  if (due.length === 0) return { ok: false, error: 'Nothing is due on this yet' };

  const posted = await post(rule, due);
  refreshAll();
  return { ok: true, data: { posted } };
}

/**
 * Catches up every auto-debit that has come due.
 *
 * This is the answer to noticing ₹179 missing days later and having to dig
 * through a bank statement to work out what it was. The charge leaves whether
 * the app was open or not, so when it next opens it writes down what already
 * happened, including anything missed while the machine was off.
 *
 * Only rules marked `autoPost` are touched. Everything else stays a reminder.
 * Deliberately does not revalidate: it runs during a render, and the caller
 * reads fresh data straight after.
 */
export async function catchUpAutoPosted(asOf: DayString = istToday()): Promise<number> {
  const candidates = await db
    .select()
    .from(recurring)
    .where(and(eq(recurring.active, true), eq(recurring.autoPost, true), lte(recurring.nextDueOn, asOf)));

  let total = 0;
  for (const rule of candidates) {
    const due = duePostings(
      {
        startsOn: rule.startsOn,
        intervalUnit: rule.intervalUnit,
        intervalCount: rule.intervalCount,
        endsOn: rule.endsOn,
      },
      rule.postedCount,
      asOf,
    );
    total += await post(rule, due);
  }

  return total;
}
