import { and, asc, eq, lte } from 'drizzle-orm';

import { addDays, today as istToday, type DayString } from '../date';
import { db } from '../db/client';
import { recurring } from '../db/schema';
import {
  burnRate,
  computePosition,
  computeRunway,
  dailyAllowance,
  loggingStreak,
  summariseDays,
  type Commitment,
  type Position,
  type Runway,
} from '../domain/position';
import { duePostings } from '../domain/recurring';
import { debtTotals, getDebtsWithPositions, type DebtWithPosition } from './debts';
import { getLedgerEntries, getLoggedDays, getMovements, type LedgerEntry } from './ledger';
import { activeLoans, getLoansWithSchedules, type LoanWithSchedule } from './loans';
import { getAccounts, getPreferences } from './reference';

/**
 * The single call behind the home screen.
 *
 * Everything the hero number depends on is loaded here and passed through the
 * pure engines, so the number on screen is always reproducible from data the
 * page also has, and can be broken down for the user rather than asserted.
 */

export interface Overview {
  asOf: DayString;
  position: Position;
  runway: Runway;
  allowance: ReturnType<typeof dailyAllowance>;
  todayEntries: LedgerEntry[];
  todayIn: number;
  todayOut: number;
  streak: number;
  debts: DebtWithPosition[];
  loans: LoanWithSchedule[];
  nextIncomeOn: DayString | null;
  recentDays: Array<{ day: DayString; in: number; out: number; net: number; count: number }>;
  accounts: Awaited<ReturnType<typeof getAccounts>>;
  balances: Map<string, number>;
  dueSoon: Commitment[];
}

export async function getOverview(asOf: DayString = istToday()): Promise<Overview> {
  const preferences = await getPreferences();

  const [accountRows, movements, debtEntries, loanEntries, recurringRows, loggedDays, todayEntries] =
    await Promise.all([
      getAccounts(),
      getMovements(undefined, asOf),
      getDebtsWithPositions(asOf),
      getLoansWithSchedules(asOf),
      db.select().from(recurring).where(eq(recurring.active, true)).orderBy(asc(recurring.nextDueOn)),
      getLoggedDays(),
      getLedgerEntries({ from: asOf, to: asOf, limit: 100 }),
    ]);

  const horizonEnd = addDays(asOf, preferences.horizonDays);
  const commitments = buildCommitments(loanEntries, debtEntries, recurringRows, asOf, horizonEnd);
  const totals = debtTotals(debtEntries);

  const position = computePosition({
    asOf,
    accounts: accountRows.map((a) => ({ id: a.id, kind: a.kind, openingBalance: a.openingBalance })),
    movements,
    owedToMe: totals.owedToMe,
    owedByMeToPeople: totals.owedByMe,
    loanPrincipalOutstanding: activeLoans(loanEntries).reduce((n, l) => n + l.principalOutstanding, 0),
    commitments,
    buffer: preferences.buffer,
    horizonDays: preferences.horizonDays,
  });

  const dailyBurn = burnRate(movements, asOf, preferences.burnWindowDays);
  const nextIncome = recurringRows.find((r) => r.kind === 'income' && r.nextDueOn >= asOf);

  const summaries = summariseDays(movements);
  const recentDays = [];
  for (let i = 29; i >= 0; i -= 1) {
    const day = addDays(asOf, -i);
    recentDays.push(summaries.get(day) ?? { day, in: 0, out: 0, net: 0, count: 0 });
  }

  const todaySummary = summaries.get(asOf);

  return {
    asOf,
    position,
    runway: computeRunway(position, dailyBurn),
    allowance: dailyAllowance(position, nextIncome?.nextDueOn ?? null),
    todayEntries,
    todayIn: todaySummary?.in ?? 0,
    todayOut: todaySummary?.out ?? 0,
    streak: loggingStreak(loggedDays, asOf),
    debts: debtEntries,
    loans: loanEntries,
    nextIncomeOn: nextIncome?.nextDueOn ?? null,
    recentDays,
    accounts: accountRows,
    balances: position.balances,
    dueSoon: position.commitments,
  };
}

/**
 * Everything already promised away inside the horizon.
 *
 * Three sources, all of them real obligations rather than predictions:
 * unpaid loan installments, borrowed money with a due date, and active
 * recurring rules that move money out of hand.
 */
function buildCommitments(
  loanEntries: LoanWithSchedule[],
  debtEntries: DebtWithPosition[],
  recurringRows: Array<typeof recurring.$inferSelect>,
  asOf: DayString,
  horizonEnd: DayString,
): Commitment[] {
  const commitments: Commitment[] = [];

  for (const entry of activeLoans(loanEntries)) {
    for (const item of entry.schedule) {
      if (item.status !== 'due' || item.dueOn > horizonEnd) continue;
      commitments.push({
        id: item.id,
        label: `${entry.loan.lender}, EMI ${item.seq} of ${entry.schedule.length}`,
        dueOn: item.dueOn,
        amount: item.amount,
        source: 'installment',
        isOverdue: item.dueOn < asOf,
      });
    }
  }

  for (const entry of debtEntries) {
    if (entry.debt.direction !== 'borrowed' || entry.debt.status !== 'open') continue;
    if (entry.position.isCleared || !entry.debt.dueOn || entry.debt.dueOn > horizonEnd) continue;
    commitments.push({
      id: entry.debt.id,
      label: `Owed to ${entry.person.name}`,
      dueOn: entry.debt.dueOn,
      amount: entry.position.payoffTotal,
      source: 'debt',
      isOverdue: entry.debt.dueOn < asOf,
    });
  }

  // Every charge falling inside the horizon counts, not just the next one. A
  // weekly subscription hits four times in a month, and reserving one week of
  // it would overstate what is safe to spend.
  const OUTFLOWS = new Set(['expense', 'transfer', 'settle', 'loan_payment']);
  for (const rule of recurringRows) {
    if (!OUTFLOWS.has(rule.kind)) continue;

    const schedule = {
      startsOn: rule.startsOn,
      intervalUnit: rule.intervalUnit,
      intervalCount: rule.intervalCount,
      endsOn: rule.endsOn,
    };

    const upcoming = duePostings(schedule, rule.postedCount, horizonEnd);
    for (const dueOn of upcoming) {
      commitments.push({
        id: `${rule.id}:${dueOn}`,
        label: rule.name,
        dueOn,
        amount: rule.amount,
        source: 'recurring',
        isOverdue: dueOn < asOf,
      });
    }
  }

  return commitments;
}

/** Recurring rules that are due now and waiting to be confirmed. */
export async function getPendingRecurring(asOf: DayString = istToday()) {
  return db
    .select()
    .from(recurring)
    .where(and(eq(recurring.active, true), lte(recurring.nextDueOn, asOf)))
    .orderBy(asc(recurring.nextDueOn));
}
