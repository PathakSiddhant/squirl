import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { addDays, isDayString, toDay } from '@/lib/date';

import { happenedAt } from './queue';
import { signalContent } from './schema';

/**
 * Cutting the inbox back to the last few days.
 *
 * For the day somebody comes back to a long list and wants to start from
 * something they can finish. It is not a retention policy and nothing runs it:
 * Signal never deletes what is waiting on its own, because a queue that quietly
 * lost items would be worse than one that was long.
 *
 * ## Dismissed, not deleted
 *
 * Trimmed items leave the queue exactly as if the reader had dismissed them,
 * and that is deliberate. A sync's upsert never writes `state`, so a dismissed
 * row can never be brought back by a later pass, whereas a deleted one could be,
 * the moment a channel's checkpoint reached back far enough to see the video
 * again. It also leaves the rows in place, so a mistaken trim is an update
 * away from undone instead of a restore from a backup.
 *
 * ## Which day an item is under
 *
 * The same answer the inbox gives. `happenedAt` is what files an item under a
 * heading, so "keep Saturday and Sunday" keeps exactly the items that sit under
 * those two headings, not whatever happened to have a publication timestamp in
 * that window. A stream that began on Friday night and ended on Saturday is
 * under Friday, and is trimmed with it.
 *
 * Something live is never history, however long ago it started, and an upcoming
 * stream is filed by when it is due, so one still to come is always kept.
 */

/** Midnight IST at the start of a day, as an instant. */
export function startOfDay(day: string): number {
  if (!isDayString(day)) throw new Error(`Not a day: ${day}. Use YYYY-MM-DD.`);
  return Date.parse(`${day}T00:00:00+05:30`);
}

/**
 * The moment the last `days` calendar days begin, in IST.
 *
 * Calendar days, not blocks of twenty-four hours: two days on a Sunday afternoon
 * is Saturday and Sunday, from Saturday's midnight, not from this time on
 * Friday.
 */
export function historyCutoff(days: number, now: number = Date.now()): number {
  if (!Number.isInteger(days) || days < 1) throw new Error('Keep at least one day.');
  return startOfDay(addDays(toDay(new Date(now)), -(days - 1)));
}

export interface TrimPlan {
  /** Everything before this instant is history. */
  cutoff: number;
  /** How many items are waiting right now. */
  waiting: number;
  /** The ones that would go, with the instant each is filed under. */
  drop: Array<{ id: string; at: number }>;
}

/** What a trim to `cutoff` would do, without doing it. */
export async function planTrim(cutoff: number): Promise<TrimPlan> {
  const rows = await db
    .select({
      id: signalContent.id,
      kind: signalContent.kind,
      publishedAt: signalContent.publishedAt,
      scheduledAt: signalContent.scheduledAt,
      startedAt: signalContent.startedAt,
    })
    .from(signalContent)
    .where(eq(signalContent.state, 'unseen'));

  const drop = rows
    .filter((row) => row.kind !== 'live' && happenedAt(row) < cutoff)
    .map((row) => ({ id: row.id, at: happenedAt(row) }));

  return { cutoff, waiting: rows.length, drop };
}

/** SQLite caps the variables in one statement, and a long backlog can exceed it. */
const CHUNK = 400;

/**
 * Dismiss everything the plan names.
 *
 * Each update re-checks `state = 'unseen'`, so an item the reader dealt with
 * between planning and applying keeps the decision they made rather than
 * having it overwritten with this one.
 */
export async function applyTrim(plan: TrimPlan, now: number = Date.now()): Promise<number> {
  let dismissed = 0;

  for (let index = 0; index < plan.drop.length; index += CHUNK) {
    const ids = plan.drop.slice(index, index + CHUNK).map((entry) => entry.id);
    const result = await db
      .update(signalContent)
      .set({ state: 'dismissed', processedAt: now, snoozedUntil: null, updatedAt: now })
      .where(and(inArray(signalContent.id, ids), eq(signalContent.state, 'unseen')));
    dismissed += result.rowsAffected;
  }

  return dismissed;
}
