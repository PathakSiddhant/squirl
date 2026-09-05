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
