import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';

import { addDays, type DayString } from '../date';
import { db } from '../db/client';
import { debts, loans, reconciliations, transactions } from '../db/schema';
import { evaluateAchievements, type AchievementStats, type EarnedAchievement } from '../domain/achievements';
import { loggingStreak } from '../domain/position';

/** Everything the milestone engine needs, gathered in one pass. */
export async function getAchievementStats(
  asOf: DayString,
  known: { parked: number; netWorth: number; owedByMe: number; interestEarned: number },
): Promise<AchievementStats> {
  const thirtyDaysAgo = addDays(asOf, -29);

  const [[entryRow], loggedRows, [settledRow], [closedRow], [reconcileRow], [categoryRow]] =
    await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(transactions),
      db.selectDistinct({ day: transactions.day }).from(transactions),
      db
        .select({ n: sql<number>`count(*)` })
        .from(debts)
        .where(eq(debts.status, 'settled')),
      db
        .select({ n: sql<number>`count(*)` })
        .from(loans)
        .where(eq(loans.status, 'closed')),
      db.select({ n: sql<number>`count(*)` }).from(reconciliations),
      db
        .select({ n: sql<number>`count(distinct ${transactions.categoryId})` })
        .from(transactions)
        .where(isNotNull(transactions.categoryId)),
    ]);

  const days = new Set(loggedRows.map((r) => r.day));
  const loggedDaysLast30 = [...days].filter((d) => d >= thirtyDaysAgo && d <= asOf).length;

  return {
    entryCount: Number(entryRow?.n ?? 0),
    streak: loggingStreak(days, asOf),
    bestStreak: bestStreak(days),
    parked: known.parked,
    netWorth: known.netWorth,
    debtsSettled: Number(settledRow?.n ?? 0),
    loansClosed: Number(closedRow?.n ?? 0),
    reconciliations: Number(reconcileRow?.n ?? 0),
    interestEarned: known.interestEarned,
    owedByMe: known.owedByMe,
    loggedDaysLast30,
    distinctCategoriesUsed: Number(categoryRow?.n ?? 0),
  };
}

/**
 * The longest run of consecutive logged days there has ever been.
 *
 * Kept separate from the current streak on purpose: breaking a streak should
 * not erase the fact that you once kept one for a month.
 */
export function bestStreak(days: Set<DayString>): number {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let previous: DayString | null = null;

  for (const day of sorted) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    if (run > best) best = run;
    previous = day;
  }

  return best;
}

export async function getAchievements(
  asOf: DayString,
  known: { parked: number; netWorth: number; owedByMe: number; interestEarned: number },
): Promise<{ stats: AchievementStats; achievements: EarnedAchievement[] }> {
  const stats = await getAchievementStats(asOf, known);
  return { stats, achievements: evaluateAchievements(stats) };
}

/** Total ever parked away, for the stash meter. */
export async function getStashHistory(asOf: DayString) {
  const rows = await db
    .select({ day: transactions.day, amount: transactions.amount })
    .from(transactions)
    .where(and(eq(transactions.kind, 'transfer'), gte(transactions.day, addDays(asOf, -364))));
  return rows;
}
