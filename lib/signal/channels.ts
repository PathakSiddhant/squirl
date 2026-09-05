import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';

import { ensureCategories } from './categories';
import { newSignalId } from './id';
import { signalChannels, signalContent, type SignalChannel } from './schema';
import { fetchChannels, resolveChannel, searchChannels, type YouTubeChannel } from './youtube';

/**
 * Adding, classifying and removing the channels Signal watches.
 *
 * This list is the entire input to the product. Nothing reaches the queue that
 * did not come from a channel the reader put here by hand, which is what makes
 * the queue finite and what makes it possible to promise there is no algorithm
 * underneath it.
 */

// ------------------------------------------------------------- classifying

/**
 * Words that place a channel, strongest signal first.
 *
 * Deliberately a lookup table rather than a model. The classifier only has to
 * be right often enough to save the reader a few clicks, it has to be
 * explainable when it is wrong, and it must never be the reason a channel
 * cannot be found. A wrong guess here costs one correction; the correction
 * then sticks, because `categoryLocked` stops any later pass from overwriting
 * a human decision.
 *
 * Ordered: the first category with a match wins, so the specific ones are
 * checked before the broad ones. "Cricket highlights" is sport, not news,
 * even though a sports channel says "news" constantly.
 */
const HINTS: Array<{ slug: string; words: string[] }> = [
  {
    slug: 'programming',
    words: [
      'programming', 'developer', 'coding', 'software engineer', 'javascript', 'typescript',
      'python', 'web dev', 'frontend', 'backend', 'devops', 'open source', 'tutorial code',
    ],
  },
  {
    slug: 'sports',
    words: [
      'cricket', 'football', 'soccer', 'basketball', 'nba', 'nfl', 'formula 1', 'f1',
      'tennis', 'hockey', 'sports', 'espn', 'highlights', 'league', 'tournament', 'athlete',
    ],
  },
  {
    slug: 'technology',
    words: [
      'tech', 'technology', 'gadget', 'smartphone', 'review', 'hardware', 'consumer electronics',
      'unboxing', 'ai', 'artificial intelligence', 'computer', 'laptop', 'pc build',
    ],
  },
  {
    slug: 'gaming',
    words: ['gaming', 'gameplay', 'let’s play', 'lets play', 'esports', 'speedrun', 'playthrough'],
  },
  {
    slug: 'science',
    words: ['science', 'physics', 'chemistry', 'biology', 'astronomy', 'space', 'research', 'engineering'],
  },
  {
    slug: 'business',
    words: ['business', 'startup', 'entrepreneur', 'finance', 'investing', 'stock market', 'economy'],
  },
  {
    slug: 'politics',
    words: ['politics', 'political', 'election', 'parliament', 'policy', 'government', 'geopolitics'],
  },
  {
    slug: 'news',
    words: ['news', 'breaking', 'headlines', 'journalism', 'reporting', 'current affairs'],
  },
  {
    slug: 'education',
    words: ['education', 'learn', 'course', 'lecture', 'explained', 'teaching', 'study'],
  },
  {
    slug: 'film-tv',
    words: ['movie', 'film', 'cinema', 'trailer', 'series', 'netflix', 'tv show', 'review film'],
  },
  { slug: 'music', words: ['music', 'song', 'album', 'band', 'concert', 'guitar', 'producer'] },
  {
    slug: 'entertainment',
    words: ['comedy', 'entertainment', 'vlog', 'podcast', 'interview', 'reaction', 'sketch'],
  },
];

/**
 * A guess at where a channel belongs, from its own public words.
 *
 * Returns a slug or null. Null is a real answer and lands the channel in
 * "Other", which is honest, rather than in whichever category matched one
 * incidental word, which is not.
 */
export function classify(channel: Pick<YouTubeChannel, 'title' | 'description'>): string | null {
  const haystack = `${channel.title} ${channel.description ?? ''}`.toLowerCase();

  for (const { slug, words } of HINTS) {
    for (const word of words) {
      // Bounded on both sides so "ai" does not match "said" and "f1" does not
      // match "of10". The cheapest possible fix for the classic substring bug.
      const pattern = new RegExp(`(^|[^a-z0-9])${escape(word)}([^a-z0-9]|$)`, 'i');
      if (pattern.test(haystack)) return slug;
    }
  }
  return null;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ------------------------------------------------------------- discovering

export interface ChannelCandidate extends YouTubeChannel {
  /** Already in Signal. The UI offers "Added" rather than a second add. */
  alreadyAdded: boolean;
  /** Where the classifier would file it, before the reader sees it. */
  suggestedCategory: string | null;
}

/**
 * Find channels for a query the reader typed.
 *
 * Tries the cheap path first, always. A handle, a URL or a channel id is an
 * exact name for one channel and resolves for a single quota unit; only a
 * genuine keyword search falls through to search.list, which costs a hundred
 * units and is capped at a hundred calls a day. Typing "@mkbhd" and typing
 * "mkbhd" therefore differ in cost by two orders of magnitude, and the first
 * one is what pasting a link gives you.
 */
export async function findChannels(query: string): Promise<ChannelCandidate[]> {
  const text = query.trim();
  if (!text) return [];

  const exact = await resolveChannel(text);
  const found = exact ? [exact] : await searchChannels(text);
  if (found.length === 0) return [];

  const existing = await db
    .select({ youtubeId: signalChannels.youtubeId })
    .from(signalChannels);
  const known = new Set(existing.map((row) => row.youtubeId));

  return found.map((channel) => ({
    ...channel,
    alreadyAdded: known.has(channel.youtubeId),
    suggestedCategory: classify(channel),
  }));
}

// ----------------------------------------------------------------- adding

/**
 * Add a channel to the watched set.
 *
 * Idempotent: adding one already present returns it untouched rather than
 * duplicating it or resetting its category. The uploads playlist is captured
 * now, at the one moment we are already holding the channel resource, so no
 * later sync has to spend a unit discovering it.
 */
export async function addChannel(youtubeId: string): Promise<SignalChannel> {
  const [existing] = await db
    .select()
    .from(signalChannels)
    .where(eq(signalChannels.youtubeId, youtubeId));

  if (existing) {
    // Re-adding a channel that was switched off turns it back on. That is what
    // the reader means by adding it again, and it keeps everything already
    // pulled from it rather than starting over.
    if (!existing.enabled) {
      await db
        .update(signalChannels)
        .set({ enabled: true })
        .where(eq(signalChannels.id, existing.id));
      return { ...existing, enabled: true };
    }
    return existing;
  }

  const [fresh] = await fetchChannels([youtubeId]);
  if (!fresh) throw new Error('That channel could not be found on YouTube.');

  const categories = await ensureCategories();
  const slug = classify(fresh) ?? 'other';
  const category = categories.find((row) => row.slug === slug) ?? null;

  const row = {
    id: newSignalId('sch'),
    youtubeId: fresh.youtubeId,
    uploadsPlaylistId: fresh.uploadsPlaylistId,
    title: fresh.title,
    handle: fresh.handle,
    description: fresh.description,
    thumbnailUrl: fresh.thumbnailUrl,
    subscriberCount: fresh.subscriberCount,
    categoryId: category?.id ?? null,
  };

  await db.insert(signalChannels).values(row);
  const [saved] = await db.select().from(signalChannels).where(eq(signalChannels.id, row.id));
  return saved;
}

/**
 * Stop watching a channel, without destroying what it already brought in.
 *
 * The default is to disable rather than delete, which is what the brief asks
 * for: future content stops arriving, everything already pulled stays exactly
 * where it is and stays resolvable. Deleting the row, and with it every item
 * that came from the channel, is a separate and explicit act.
 */
export async function setChannelEnabled(channelId: string, enabled: boolean): Promise<void> {
  await db.update(signalChannels).set({ enabled }).where(eq(signalChannels.id, channelId));
}

/** Remove the channel and everything that came from it. Cascades by schema. */
export async function deleteChannel(channelId: string): Promise<void> {
  await db.delete(signalChannels).where(eq(signalChannels.id, channelId));
}

/**
 * Move a channel to a different category, and remember that a person did it.
 *
 * The lock is the point. Without it the next classification pass would file
 * the channel back where it was, and a correction the reader has to make twice
 * is a correction they stop making.
 */
export async function setChannelCategory(channelId: string, categoryId: string | null): Promise<void> {
  await db
    .update(signalChannels)
    .set({ categoryId, categoryLocked: true })
    .where(eq(signalChannels.id, channelId));
}

// ------------------------------------------------------------------ reading

export interface ChannelWithCount extends SignalChannel {
  /** Unresolved items, counted now rather than stored. */
  waiting: number;
}

/**
 * Every channel, with how much of it is still waiting.
 *
 * The count is derived on read. Keeping a column would mean every state change
 * anywhere had to remember to decrement it, and the first one that forgot
 * would leave a number nobody could trust.
 */
export async function listChannels(): Promise<ChannelWithCount[]> {
  const rows = await db
    .select({
      channel: signalChannels,
      waiting: sql<number>`
        (select count(*) from ${signalContent}
          where ${signalContent.channelId} = ${signalChannels.id}
            and ${signalContent.state} = 'unseen')
      `,
    })
    .from(signalChannels)
    .orderBy(signalChannels.title);

  return rows.map((row) => ({ ...row.channel, waiting: Number(row.waiting) }));
}
