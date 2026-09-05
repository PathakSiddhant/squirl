import { and, asc, desc, eq, gt, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { IST_TIME_ZONE } from '@/lib/date';

import { signalChannels, signalContent, type ContentKind, type ContentState } from './schema';

/**
 * The queue: everything still waiting on the reader, and the four things that
 * can be done about it.
 *
 * The defining property is that this list gets shorter. Nothing here replaces
 * a resolved item with a suggestion, and there is no query in this file that
 * returns what has already been dealt with, because a screen that can show it
 * is a watch history however it is labelled.
 */

/**
 * An item is waiting if it is unseen, or if it was snoozed until a moment that
 * has now passed.
 *
 * The second half is why no background job is needed to wake a snoozed item.
 * Nothing has to run at the appointed time and nothing has to be rescheduled
 * if the machine was asleep: the queue simply asks, every time it is read,
 * whether the moment has arrived. A snooze that expired overnight is in the
 * queue the next morning because the question is asked then, not because
 * something fired at 3am.
 */
function waitingClause(now: number) {
  return or(
    eq(signalContent.state, 'unseen'),
    and(eq(signalContent.state, 'snoozed'), lte(signalContent.snoozedUntil, now)),
  );
}

export interface QueueItem {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  kind: ContentKind;
  durationSeconds: number | null;
  publishedAt: number;
  scheduledAt: number | null;
  state: ContentState;
  channelId: string;
  channelTitle: string;
  channelThumbnail: string | null;
  categoryId: string | null;
}

export interface QueueFilters {
  channelId?: string;
  categoryId?: string;
  kinds?: ContentKind[];
  /** Seconds. Both ends optional, so "under ten minutes" and "an hour or more" both work. */
  minDuration?: number;
  maxDuration?: number;
  search?: string;
}

/**
 * Everything waiting, newest first, with its channel attached.
 *
 * One query with a join rather than a list of items followed by a lookup per
 * channel. At a few hundred items that difference is invisible; the reason to
 * write it this way is that the alternative gets slower in proportion to how
 * well the product is working for you.
 */
export async function getQueue(filters: QueueFilters = {}): Promise<QueueItem[]> {
  const now = Date.now();
  const conditions = [waitingClause(now)];

  if (filters.channelId) conditions.push(eq(signalContent.channelId, filters.channelId));
  if (filters.categoryId) conditions.push(eq(signalChannels.categoryId, filters.categoryId));
  if (filters.kinds?.length) conditions.push(inArray(signalContent.kind, filters.kinds));

  // A live stream has no duration yet, so a duration filter must not silently
  // hide it. Length filters answer "what fits in the time I have", and a live
  // broadcast is always a candidate for that.
  if (filters.minDuration !== undefined) {
    conditions.push(
      or(gt(signalContent.durationSeconds, filters.minDuration - 1), eq(signalContent.kind, 'live')),
    );
  }
  if (filters.maxDuration !== undefined) {
    conditions.push(
      or(lte(signalContent.durationSeconds, filters.maxDuration), eq(signalContent.kind, 'live')),
    );
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${signalContent.title}) like ${term}`,
        sql`lower(${signalChannels.title}) like ${term}`,
      ),
    );
  }

  const rows = await db
    .select({
      id: signalContent.id,
      youtubeId: signalContent.youtubeId,
      title: signalContent.title,
      thumbnailUrl: signalContent.thumbnailUrl,
      kind: signalContent.kind,
      durationSeconds: signalContent.durationSeconds,
      publishedAt: signalContent.publishedAt,
      scheduledAt: signalContent.scheduledAt,
      state: signalContent.state,
      channelId: signalChannels.id,
      channelTitle: signalChannels.title,
      channelThumbnail: signalChannels.thumbnailUrl,
      categoryId: signalChannels.categoryId,
    })
    .from(signalContent)
    .innerJoin(signalChannels, eq(signalContent.channelId, signalChannels.id))
    .where(and(...conditions))
    .orderBy(desc(signalContent.publishedAt));

  return rows;
}

/** Anything live right now, across every channel. Its own question, so its own query. */
export async function getLive(): Promise<QueueItem[]> {
  return getQueue({ kinds: ['live'] });
}

/** Scheduled broadcasts that have not started, soonest first. */
export async function getUpcoming(): Promise<QueueItem[]> {
  const now = Date.now();
  const rows = await db
    .select({
      id: signalContent.id,
      youtubeId: signalContent.youtubeId,
      title: signalContent.title,
      thumbnailUrl: signalContent.thumbnailUrl,
      kind: signalContent.kind,
      durationSeconds: signalContent.durationSeconds,
      publishedAt: signalContent.publishedAt,
      scheduledAt: signalContent.scheduledAt,
      state: signalContent.state,
      channelId: signalChannels.id,
      channelTitle: signalChannels.title,
      channelThumbnail: signalChannels.thumbnailUrl,
      categoryId: signalChannels.categoryId,
    })
    .from(signalContent)
    .innerJoin(signalChannels, eq(signalContent.channelId, signalChannels.id))
    .where(
      and(
        waitingClause(now),
        eq(signalContent.kind, 'upcoming'),
        isNotNull(signalContent.scheduledAt),
      ),
    )
    .orderBy(asc(signalContent.scheduledAt));

  return rows;
}

// ------------------------------------------------------------- the decisions

/**
 * Leave the queue, one way or another.
 *
 * `done` and `dismissed` are the same mechanism and differ only in what the
 * reader meant, which is worth recording and worth never counting. Neither is
 * reversible by a sync: the upsert has no permission to write this column.
 */
async function resolve(contentId: string, state: 'done' | 'dismissed'): Promise<void> {
  await db
    .update(signalContent)
    .set({ state, processedAt: Date.now(), snoozedUntil: null, updatedAt: Date.now() })
    .where(eq(signalContent.id, contentId));
}

export const markDone = (contentId: string) => resolve(contentId, 'done');
export const dismiss = (contentId: string) => resolve(contentId, 'dismissed');

/**
 * Put it down and pick it up later.
 *
 * The distinction from a watch-later list is that this has an end. A list you
 * add to forever becomes the backlog it was meant to solve; a postponement
 * returns on its own and has to be dealt with again.
 */
export async function snooze(contentId: string, until: number): Promise<void> {
  await db
    .update(signalContent)
    .set({ state: 'snoozed', snoozedUntil: until, processedAt: null, updatedAt: Date.now() })
    .where(eq(signalContent.id, contentId));
}

/**
 * Undo. Straight back to unseen, whatever it was.
 *
 * Exists because dismissal is one keystroke and fingers slip. Without it the
 * fast path is frightening, and a frightening fast path does not get used.
 */
export async function restore(contentId: string): Promise<void> {
  await db
    .update(signalContent)
    .set({ state: 'unseen', snoozedUntil: null, processedAt: null, updatedAt: Date.now() })
    .where(eq(signalContent.id, contentId));
}

// ---------------------------------------------------------------- grouping

export interface DayGroup {
  /** YYYY-MM-DD in IST. */
  day: string;
  label: string;
  items: QueueItem[];
}

/**
 * The queue, cut into days.
 *
 * Done here rather than in SQL because the day boundary is a question about
 * the reader's timezone, not about the stored instant: two videos ninety
 * minutes apart can fall on different Indian days while sharing a UTC one.
 * SQLite would need the offset baked into the query to get this right, and
 * baking a timezone into a query is how a database ends up lying every March.
 */
export function groupByDay(items: QueueItem[]): DayGroup[] {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const today = formatter.format(new Date());
  const yesterday = formatter.format(new Date(Date.now() - 86_400_000));

  const buckets = new Map<string, QueueItem[]>();
  for (const item of items) {
    // A scheduled broadcast belongs on the day it will happen, not the day its
    // placeholder was published, which is often weeks earlier.
    const at = item.kind === 'upcoming' && item.scheduledAt ? item.scheduledAt : item.publishedAt;
    const day = formatter.format(new Date(at));
    const bucket = buckets.get(day);
    if (bucket) bucket.push(item);
    else buckets.set(day, [item]);
  }

  const label = (day: string): string => {
    if (day === today) return 'Today';
    if (day === yesterday) return 'Yesterday';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIME_ZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${day}T00:00:00+05:30`));
  };

  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, group]) => ({ day, label: label(day), items: group }));
}

// ------------------------------------------------------------------ counts

export interface QueueSummary {
  waiting: number;
  live: number;
  upcoming: number;
  snoozed: number;
}

/** The one number the launcher tile shows, plus what the home screen needs. */
export async function getSummary(): Promise<QueueSummary> {
  const now = Date.now();

  const [row] = await db
    .select({
      waiting: sql<number>`sum(case when ${signalContent.state} = 'unseen'
        or (${signalContent.state} = 'snoozed' and ${signalContent.snoozedUntil} <= ${now})
        then 1 else 0 end)`,
      live: sql<number>`sum(case when ${signalContent.kind} = 'live'
        and ${signalContent.state} = 'unseen' then 1 else 0 end)`,
      upcoming: sql<number>`sum(case when ${signalContent.kind} = 'upcoming'
        and ${signalContent.state} = 'unseen' then 1 else 0 end)`,
      snoozed: sql<number>`sum(case when ${signalContent.state} = 'snoozed'
        and ${signalContent.snoozedUntil} > ${now} then 1 else 0 end)`,
    })
    .from(signalContent);

  return {
    waiting: Number(row?.waiting ?? 0),
    live: Number(row?.live ?? 0),
    upcoming: Number(row?.upcoming ?? 0),
    snoozed: Number(row?.snoozed ?? 0),
  };
}
