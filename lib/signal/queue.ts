import { and, asc, desc, eq, gt, inArray, isNotNull, lte, or, sql, type SQL } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { IST_TIME_ZONE } from '@/lib/date';

import { signalCategories, signalChannels, signalContent, type ContentKind, type ContentState } from './schema';

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
 * An item is waiting if it is unseen. That is the whole rule.
 *
 * There used to be a second half: an item snoozed until a moment that had since
 * passed also counted as waiting. Snoozing is gone — YouTube has Watch Later
 * and a queue whose promise is that it gets shorter should not ship the control
 * that lets you defer forever — and the rule got simpler with it.
 *
 * The `snoozed` state stays in the schema because dropping a column in SQLite
 * means rebuilding the table, and rebuilding a table holding the reader's data
 * to delete a value nothing writes any more is a bad trade. Nothing can reach
 * that state now, so nothing can be stranded in it.
 */
function waitingClause() {
  return eq(signalContent.state, 'unseen');
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
  startedAt: number | null;
  state: ContentState;
  channelId: string;
  channelTitle: string;
  channelThumbnail: string | null;
  categoryId: string | null;
  /** Where the reader put this channel's group on the Channels shelf. Null for
   *  an uncategorised channel, which sorts last. */
  categoryPosition: number | null;
  /** Where the reader put this channel within its group. Null for one never
   *  dragged, which sorts after anything that has been. */
  channelPosition: number | null;
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
  // Typed rather than inferred: `or()` is declared as possibly undefined when
  // handed no clauses, and an array inferred from the first element would then
  // refuse the ones pushed below.
  const conditions: Array<SQL | undefined> = [waitingClause()];

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
      startedAt: signalContent.startedAt,
      state: signalContent.state,
      channelId: signalChannels.id,
      channelTitle: signalChannels.title,
      channelThumbnail: signalChannels.thumbnailUrl,
      categoryId: signalChannels.categoryId,
      categoryPosition: signalCategories.position,
      channelPosition: signalChannels.position,
    })
    .from(signalContent)
    .innerJoin(signalChannels, eq(signalContent.channelId, signalChannels.id))
    // Left, not inner: an uncategorised channel has no row to join to, and it
    // must still appear rather than vanish from its own inbox.
    .leftJoin(signalCategories, eq(signalChannels.categoryId, signalCategories.id))
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
      startedAt: signalContent.startedAt,
      state: signalContent.state,
      channelId: signalChannels.id,
      channelTitle: signalChannels.title,
      channelThumbnail: signalChannels.thumbnailUrl,
      categoryId: signalChannels.categoryId,
      categoryPosition: signalCategories.position,
      channelPosition: signalChannels.position,
    })
    .from(signalContent)
    .innerJoin(signalChannels, eq(signalContent.channelId, signalChannels.id))
    .leftJoin(signalCategories, eq(signalChannels.categoryId, signalCategories.id))
    .where(
      and(
        waitingClause(),
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
 * Undo. Straight back to unseen, whatever it was.
 *
 * Exists because dismissal is one click and fingers slip. Without it the fast
 * path is frightening, and a frightening fast path does not get used.
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
/**
 * The moment an item belongs to.
 *
 * Not its publication time. YouTube stamps a livestream as published when it
 * *ends*, so a show that ran from ten at night until half past one lands on the
 * following day and is filed under a date nobody watched it on. What people
 * mean by "when was this" for a broadcast is when it began.
 *
 * So: a broadcast that happened is placed by when it started, one still to come
 * by when it is due, and an ordinary upload by when it was published, which for
 * an upload is the same instant anyway.
 */
export function happenedAt(item: QueueItem): number {
  if (item.kind === 'upcoming') return item.scheduledAt ?? item.publishedAt;
  return item.startedAt ?? item.publishedAt;
}

/**
 * The reader's own arrangement, applied to what they are shown.
 *
 * The day something happened is still a fact about the world and stays out of
 * this: `groupByDay` decides which bucket an item lands in, and this only
 * decides the order *within* one. What changes is which group of channels is
 * looked at first, and within a group which channel, because that arrangement
 * is something the reader built by hand on the Channels shelf and this is the
 * one place it was going unused. Three sports videos and two politics videos
 * from the same day now read top to bottom the way the shelf reads left to
 * right, rather than in whatever order YouTube happened to publish them.
 *
 * A channel or category never dragged sorts after ones that have been, the
 * same rule the shelf itself uses, so a freshly added channel does not jump
 * ahead of an arrangement the reader spent time on. Within one channel on one
 * day, newest first, which is the only ordering nobody has an opinion about.
 */
export function orderByShelf(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    const category = (a.categoryPosition ?? Infinity) - (b.categoryPosition ?? Infinity);
    if (category !== 0) return category;

    const channel = (a.channelPosition ?? Infinity) - (b.channelPosition ?? Infinity);
    if (channel !== 0) return channel;

    return happenedAt(b) - happenedAt(a);
  });
}

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
    const day = formatter.format(new Date(happenedAt(item)));
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
    .map(([day, group]) => ({ day, label: label(day), items: orderByShelf(group) }));
}

// ------------------------------------------------------------------ counts

export interface QueueSummary {
  waiting: number;
  live: number;
  upcoming: number;
}

/** The one number the launcher tile shows, plus what the home screen needs. */
export async function getSummary(): Promise<QueueSummary> {
  const [row] = await db
    .select({
      waiting: sql<number>`sum(case when ${signalContent.state} = 'unseen' then 1 else 0 end)`,
      live: sql<number>`sum(case when ${signalContent.kind} = 'live'
        and ${signalContent.state} = 'unseen' then 1 else 0 end)`,
      upcoming: sql<number>`sum(case when ${signalContent.kind} = 'upcoming'
        and ${signalContent.state} = 'unseen' then 1 else 0 end)`,
    })
    .from(signalContent);

  return {
    waiting: Number(row?.waiting ?? 0),
    live: Number(row?.live ?? 0),
    upcoming: Number(row?.upcoming ?? 0),
  };
}
