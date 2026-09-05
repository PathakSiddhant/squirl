'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  addChannel,
  deleteChannel,
  findChannels,
  setChannelCategory,
  setChannelEnabled,
  type ChannelCandidate,
} from '@/lib/signal/channels';
import { dismiss, markDone, restore, snooze } from '@/lib/signal/queue';
import { syncNow } from '@/lib/signal/scheduler';
import { YouTubeError } from '@/lib/signal/youtube';

/**
 * Signal's boundary with the browser.
 *
 * Everything arriving here is validated before it reaches the domain, and
 * nothing leaving here is a raw error. A YouTube failure becomes a sentence
 * the reader can act on; a stack trace is written to the server log where it
 * is useful and nowhere else.
 */

const id = z.string().min(1).max(64);

/** Errors as the reader should meet them. */
function explain(error: unknown): string {
  if (error instanceof YouTubeError) {
    switch (error.kind) {
      case 'offline':
        return 'You are offline. Everything already synced is still here.';
      case 'quota':
        return 'YouTube’s daily quota is used up. Try again tomorrow.';
      case 'auth':
        return 'YouTube refused the API key. Check YOUTUBE_API_KEY in .env.local.';
      case 'notFound':
        return 'Nothing on YouTube matches that.';
      default:
        return 'YouTube could not be reached right now.';
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong.';
}

export interface SearchState {
  query: string;
  results: ChannelCandidate[];
  error: string | null;
}

/**
 * Look for a channel to add.
 *
 * Costs one quota unit when given a handle, a URL or a channel id, and a
 * hundred when given loose words. The UI says so, because a reader who knows
 * that pasting a link is cheaper will paste links.
 */
export async function searchForChannels(
  _previous: SearchState,
  formData: FormData,
): Promise<SearchState> {
  const query = String(formData.get('query') ?? '').trim();
  if (!query) return { query, results: [], error: null };

  try {
    return { query, results: await findChannels(query), error: null };
  } catch (error) {
    console.error('[signal] channel search failed', error);
    return { query, results: [], error: explain(error) };
  }
}

export async function addChannelById(youtubeId: string): Promise<{ error: string | null }> {
  const parsed = id.safeParse(youtubeId);
  if (!parsed.success) return { error: 'That channel id is malformed.' };

  try {
    await addChannel(parsed.data);
    revalidatePath('/signal', 'layout');
    return { error: null };
  } catch (error) {
    console.error('[signal] add channel failed', error);
    return { error: explain(error) };
  }
}

export async function toggleChannel(channelId: string, enabled: boolean): Promise<void> {
  const parsed = id.safeParse(channelId);
  if (!parsed.success) return;
  await setChannelEnabled(parsed.data, enabled);
  revalidatePath('/signal', 'layout');
}

export async function removeChannel(channelId: string): Promise<void> {
  const parsed = id.safeParse(channelId);
  if (!parsed.success) return;
  await deleteChannel(parsed.data);
  revalidatePath('/signal', 'layout');
}

export async function recategoriseChannel(channelId: string, categoryId: string): Promise<void> {
  const parsedChannel = id.safeParse(channelId);
  if (!parsedChannel.success) return;
  await setChannelCategory(parsedChannel.data, categoryId || null);
  revalidatePath('/signal', 'layout');
}

// ------------------------------------------------------------- the decisions

const decisions = { done: markDone, dismissed: dismiss, restored: restore } as const;

export async function decide(
  contentId: string,
  decision: keyof typeof decisions,
): Promise<{ error: string | null }> {
  const parsed = id.safeParse(contentId);
  if (!parsed.success) return { error: 'Unknown item.' };

  await decisions[decision](parsed.data);
  revalidatePath('/signal', 'layout');
  return { error: null };
}

/**
 * Snooze until an absolute instant.
 *
 * The instant is computed in the browser, where the reader's idea of "tomorrow
 * morning" lives, and only validated here. Recomputing it on the server would
 * mean the server's clock deciding what tomorrow means.
 */
export async function snoozeUntil(contentId: string, until: number): Promise<{ error: string | null }> {
  const parsed = id.safeParse(contentId);
  if (!parsed.success) return { error: 'Unknown item.' };

  const when = z.number().int().positive().safeParse(until);
  if (!when.success || when.data <= Date.now()) return { error: 'That time has already passed.' };

  await snooze(parsed.data, when.data);
  revalidatePath('/signal', 'layout');
  return { error: null };
}

// ------------------------------------------------------------------- syncing

export async function requestSync(): Promise<{ added: number; offline: boolean; error: string | null }> {
  try {
    const run = await syncNow();
    revalidatePath('/signal', 'layout');
    return { added: run.added, offline: run.offline, error: null };
  } catch (error) {
    console.error('[signal] manual sync failed', error);
    return { added: 0, offline: false, error: explain(error) };
  }
}

// ---------------------------------------------------------------- categories

/**
 * Make a category of the reader's own.
 *
 * The seeded thirteen are a starting point, not a taxonomy. Somebody who
 * follows eleven football channels wants a Football category whatever the
 * classifier thinks, and a product that will not let them make one is telling
 * them their own shelf is wrong.
 */
export async function createCategory(name: string): Promise<{ id: string | null; error: string | null }> {
  const clean = name.trim().slice(0, 32);
  if (!clean) return { id: null, error: 'Give it a name.' };

  const { db } = await import('@/lib/db/client');
  const { signalCategories } = await import('@/lib/signal/schema');
  const { newSignalId } = await import('@/lib/signal/id');
  const { eq } = await import('drizzle-orm');

  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return { id: null, error: 'Use a few letters or numbers.' };

  const [existing] = await db
    .select()
    .from(signalCategories)
    .where(eq(signalCategories.slug, slug));
  if (existing) return { id: existing.id, error: null };

  const id = newSignalId('scat');
  await db.insert(signalCategories).values({ id, name: clean, slug, position: 100 });
  revalidatePath('/signal', 'layout');
  return { id, error: null };
}

/** Remove a category. Channels in it fall back to uncategorised, never deleted. */
export async function deleteCategory(categoryId: string): Promise<void> {
  const parsed = id.safeParse(categoryId);
  if (!parsed.success) return;

  const { db } = await import('@/lib/db/client');
  const { signalCategories } = await import('@/lib/signal/schema');
  const { eq } = await import('drizzle-orm');

  await db.delete(signalCategories).where(eq(signalCategories.id, parsed.data));
  revalidatePath('/signal', 'layout');
}

/**
 * Re-run the classifier over every channel, with the model if one is reachable.
 *
 * Channels the reader has filed by hand are left alone: `categoryLocked` is
 * what makes a correction stick, and a re-classification that overwrote human
 * decisions would be a button that undoes your work.
 */
export async function reclassifyAll(): Promise<{ changed: number; usedModel: boolean; error: string | null }> {
  try {
    const { db } = await import('@/lib/db/client');
    const { signalChannels } = await import('@/lib/signal/schema');
    const { ensureCategories } = await import('@/lib/signal/categories');
    const { classify } = await import('@/lib/signal/channels');
    const { classifyWithAI } = await import('@/lib/signal/intelligence');
    const { eq } = await import('drizzle-orm');

    const rows = (await db.select().from(signalChannels)).filter((row) => !row.categoryLocked);
    if (rows.length === 0) return { changed: 0, usedModel: false, error: null };

    const categories = await ensureCategories();
    const bySlug = new Map(categories.map((row) => [row.slug, row]));

    const fromModel = await classifyWithAI(
      rows.map((row) => ({
        youtubeId: row.youtubeId,
        title: row.title,
        description: row.description,
        handle: row.handle,
        thumbnailUrl: row.thumbnailUrl,
        subscriberCount: row.subscriberCount,
        uploadsPlaylistId: row.uploadsPlaylistId,
      })),
    );

    let changed = 0;

    for (const row of rows) {
      const slug =
        fromModel?.find((entry) => entry.youtubeId === row.youtubeId)?.category ??
        classify(row) ??
        'other';
      const category = bySlug.get(slug) ?? bySlug.get('other');
      if (!category || category.id === row.categoryId) continue;

      await db
        .update(signalChannels)
        .set({ categoryId: category.id })
        .where(eq(signalChannels.id, row.id));
      changed += 1;
    }

    revalidatePath('/signal', 'layout');
    return { changed, usedModel: fromModel !== null, error: null };
  } catch (error) {
    console.error('[signal] reclassify failed', error);
    return { changed: 0, usedModel: false, error: explain(error) };
  }
}

// ----------------------------------------------------------------- ordering

/**
 * Persist an arrangement the reader made by hand.
 *
 * Sent as the whole ordered list rather than as a single moved item, because
 * that is what the screen knows after a drag and it is the only version that
 * cannot drift: recomputing neighbours server-side from one index would have to
 * reproduce the exact reordering the browser already performed.
 *
 * Moving a channel into a different group counts as filing it by hand, so it
 * locks the category against a later re-classification, exactly as choosing
 * from the menu does.
 */
export async function saveChannelOrder(
  groups: Array<{ categoryId: string | null; channelIds: string[] }>,
): Promise<void> {
  const { db } = await import('@/lib/db/client');
  const { signalChannels } = await import('@/lib/signal/schema');
  const { eq } = await import('drizzle-orm');

  for (const group of groups) {
    for (const [index, channelId] of group.channelIds.entries()) {
      const parsed = id.safeParse(channelId);
      if (!parsed.success) continue;

      await db
        .update(signalChannels)
        .set({
          position: index,
          categoryId: group.categoryId,
          categoryLocked: true,
        })
        .where(eq(signalChannels.id, parsed.data));
    }
  }

  revalidatePath('/signal', 'layout');
}

/** The order the groups themselves stack in. */
export async function saveCategoryOrder(categoryIds: string[]): Promise<void> {
  const { db } = await import('@/lib/db/client');
  const { signalCategories } = await import('@/lib/signal/schema');
  const { eq } = await import('drizzle-orm');

  for (const [index, categoryId] of categoryIds.entries()) {
    const parsed = id.safeParse(categoryId);
    if (!parsed.success) continue;
    await db
      .update(signalCategories)
      .set({ position: index })
      .where(eq(signalCategories.id, parsed.data));
  }

  revalidatePath('/signal', 'layout');
}
