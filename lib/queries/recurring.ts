import { and, asc, eq, lte } from 'drizzle-orm';

import { today as istToday, type DayString } from '../date';
import { db } from '../db/client';
import { accounts, categories, recurring, type Recurring } from '../db/schema';
import { duePostings, nextDueOn, yearlyCost } from '../domain/recurring';

/** A rule with the names it points at, ready to render. */
export interface RecurringView {
  rule: Recurring;
  accountName: string | null;
  counterAccountName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  /** Occurrences due on or before today that have not been written yet. */
  overdue: DayString[];
  /** What this costs across a year, so plans can be compared. */
  perYear: number;
  finished: boolean;
}

export async function getRecurring(asOf: DayString = istToday()): Promise<RecurringView[]> {
  const rows = await db
    .select({
      rule: recurring,
      accountName: accounts.name,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(recurring)
    .leftJoin(accounts, eq(recurring.accountId, accounts.id))
    .leftJoin(categories, eq(recurring.categoryId, categories.id))
    .orderBy(asc(recurring.nextDueOn));

  // Destination account for transfers, resolved separately to keep the join simple.
  const allAccounts = await db.select({ id: accounts.id, name: accounts.name }).from(accounts);
  const nameOf = new Map(allAccounts.map((a) => [a.id, a.name]));

  return rows.map(({ rule, accountName, categoryName, categoryIcon }) => {
    const schedule = {
      startsOn: rule.startsOn,
      intervalUnit: rule.intervalUnit,
      intervalCount: rule.intervalCount,
      endsOn: rule.endsOn,
    };

    return {
      rule,
      accountName,
      counterAccountName: rule.counterAccountId ? (nameOf.get(rule.counterAccountId) ?? null) : null,
      categoryName,
      categoryIcon,
      overdue: rule.active ? duePostings(schedule, rule.postedCount, asOf) : [],
      perYear: yearlyCost(rule.amount, rule.intervalUnit, rule.intervalCount),
      finished: nextDueOn(schedule, rule.postedCount) === null,
    };
  });
}

/** Active rules whose next charge falls inside the window. */
export async function getUpcomingRecurring(asOf: DayString, through: DayString) {
  return db
    .select()
    .from(recurring)
    .where(and(eq(recurring.active, true), lte(recurring.nextDueOn, through)))
    .orderBy(asc(recurring.nextDueOn));
}
