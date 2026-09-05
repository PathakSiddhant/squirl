import { asc, eq, sql } from 'drizzle-orm';

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
    slug: 'entertainment',
    words: [
      'comedy', 'comedian', 'entertainment', 'vlog', 'vlogger', 'vines', 'podcast',
      'interview', 'reaction', 'reacts', 'sketch', 'standup', 'stand up', 'roast',
      'parody', 'prank', 'meme', 'memes', 'humour', 'humor', 'funny', 'satire',
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
    words: [
      'gaming', 'gamer', 'gameplay', 'let’s play', 'lets play', 'esports',
      'speedrun', 'playthrough', 'streamer', 'bgmi', 'valorant', 'minecraft',
    ],
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
];

/**
 * A guess at where a channel belongs, from its own public words.
 *
 * Returns a slug or null. Null is a real answer and lands the channel in
 * "Other", which is honest, rather than in whichever category matched one
 * incidental word, which is not.
 */
export function classify(channel: Pick<YouTubeChannel, 'title' | 'description'>): string | null {
  const haystack = `${channel.title} ${strip(channel.description)}`.toLowerCase();

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

/**
 * Cut the boilerplate every channel description carries.
 *
 * Almost every creator signs off with a contact line, and almost every contact
 * line contains the word "business". Matching against the raw text therefore
 * filed CarryMinati, BB Ki Vines, Angry Prash and half a dozen other comedians
 * under Business, which is not a subtle failure: it was wrong on the first
 * screen, for the most recognisable names on the list.
 *
 * Contact details say who to email and where else to follow. They never say
 * what a channel is about, so they are removed before a single word is matched.
 */
function strip(description: string | null): string {
  if (!description) return '';

  return description
    .split(/\r?\n/)
    .filter((line) => {
      const text = line.toLowerCase();
      if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) return false;
      if (/business\s+(enquir|inquir|purpose|email|contact|proposal|relat)/.test(text)) return false;
      if (/for\s+(business|brand|collab|promotion|sponsor|advertis)/.test(text)) return false;
      if (/(instagram|twitter|facebook|whatsapp|telegram|discord|snapchat|threads)\s*[:\-@]/.test(text)) {
        return false;
      }
      if (/^\s*https?:\/\//.test(text)) return false;
      return true;
    })
    .join(' ');
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
    .select()
    .from(signalChannels)
    // The reader's own arrangement first. Nulls sort last in SQLite's ASC, so
    // anything never dragged keeps its alphabetical place at the end of its
    // group rather than jumping to the front.
    .orderBy(asc(signalChannels.position), asc(signalChannels.title));

  /*
    Counted with a grouped aggregate rather than a correlated subquery.

    The subquery version was silently wrong for as long as it existed. Drizzle
    renders a bare column reference inside a `sql` template without its table,
    so `where ${signalContent.channelId} = ${signalChannels.id}` came out as
    `where "channel_id" = "id"` — and inside the subquery both of those resolve
    against `signal_content` itself. It compared every row's channel id to its
    own id, matched nothing, and returned zero for every channel on the shelf
    while the inbox sat there listing the very items it was failing to count.

    A grouped query cannot go wrong that way: there is no outer scope for a
    column to be captured by.

    The rule matches the inbox's exactly — unseen — because a badge that
    disagreed with the list it points at would be worse than no badge.
  */
  const counts = await db
    .select({
      channelId: signalContent.channelId,
      waiting: sql<number>`count(*)`,
    })
    .from(signalContent)
    .where(eq(signalContent.state, 'unseen'))
    .groupBy(signalContent.channelId);

  const waiting = new Map(counts.map((row) => [row.channelId, Number(row.waiting)]));
  return rows.map((row) => ({ ...row, waiting: waiting.get(row.id) ?? 0 }));
}
