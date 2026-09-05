import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';

import { SIGNAL_EPOCH, beforeBaseline } from './epoch';
import { newSignalId } from './id';
import { signalChannels, signalContent, type SignalChannel } from './schema';
import {
  fetchChannels,
  fetchUploadsPage,
  fetchVideos,
  YouTubeError,
  type UploadRef,
  type YouTubeVideo,
} from './youtube';

/**
 * The sync engine.
 *
 * One rule holds the whole thing together: **the local database is the truth,
 * and YouTube is only a source of new rows for it.** Nothing here reads a
 * screen's needs, nothing here decides what the reader sees, and nothing the
 * reader has decided is ever overwritten by a sync.
 *
 * ## Catch-up, not polling
 *
 * A sync asks "what has appeared since my last *successful* sync", never "what
 * appeared in the last three hours". Those are the same question only when
 * nothing has gone wrong. After eight hours offline they are very different,
 * and the second one silently loses everything published in between. The
 * checkpoint is what makes time offline harmless.
 *
 * ## Idempotency
 *
 * Every write is an upsert keyed on YouTube's own video id, which carries a
 * unique index. Running the same sync twice, or dying halfway through a page
 * and starting again, converges on the same rows. The upsert deliberately does
 * not list `state`, `snoozed_until` or `processed_at` in what it overwrites, so
 * an item already dealt with cannot be resurrected as unseen by a later pass.
 * That is the single most important line in this file.
 */

/**
 * How far back a channel's first sync reaches.
 *
 * A channel with a decade of uploads would otherwise arrive as a thousand
 * unread items, which is precisely the backlog Signal exists to abolish. The
 * first sync takes a recent window and treats everything older as already
 * behind you.
 */
const FIRST_SYNC_DAYS = 30;

/** Pages of fifty. A hard stop so one enormous channel cannot run away. */
const MAX_PAGES = 6;

export interface SyncResult {
  channelId: string;
  title: string;
  added: number;
  updated: number;
  ok: boolean;
  error?: string;
}

/** What the reader is told when something goes wrong. Never the raw error. */
function humanError(error: unknown): { message: string; offline: boolean } {
  if (error instanceof YouTubeError) {
    switch (error.kind) {
      case 'offline':
        return { message: 'No connection to YouTube.', offline: true };
      case 'quota':
        return { message: 'YouTube’s daily quota is used up. Sync will resume tomorrow.', offline: false };
      case 'auth':
        return { message: 'YouTube refused the API key.', offline: false };
      case 'notFound':
        return { message: 'This channel is no longer available on YouTube.', offline: false };
      case 'malformed':
        return { message: 'YouTube returned something unexpected.', offline: false };
      default:
        return { message: 'YouTube could not be reached right now.', offline: false };
    }
  }
  return { message: 'Something went wrong while syncing.', offline: false };
}

/**
 * Collect the uploads that are new to us, newest first.
 *
 * Stops at the first thing already seen rather than reading the whole
 * playlist. Two independent stopping conditions, because either alone has a
 * hole: the last-seen id fails if that video was deleted, and the timestamp
 * fails if a channel back-dates or re-publishes. Together they terminate.
 */
async function collectNewUploads(channel: SignalChannel, playlistId: string): Promise<UploadRef[]> {
  const window =
    channel.lastSyncedAt === null
      ? Date.now() - FIRST_SYNC_DAYS * 86_400_000
      : // A day of overlap on every pass. Playlist ordering is not guaranteed to
        // be strictly by publication time, and re-reading a handful of items we
        // already have costs nothing because the upsert makes it a no-op.
        channel.lastSyncedAt - 86_400_000;

  // The baseline wins over both. Whatever the checkpoint says, nothing from
  // before the moment tracking began is ever collected, so the first sync
  // after the baseline starts genuinely empty rather than importing whatever
  // the thirty-day window happened to reach back into.
  const floor = Math.max(window, SIGNAL_EPOCH);

  const found: UploadRef[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { items, nextPageToken } = await fetchUploadsPage(playlistId, pageToken);
    if (items.length === 0) break;

    let reachedKnownGround = false;
    for (const item of items) {
      if (item.videoId === channel.lastSeenVideoId) {
        reachedKnownGround = true;
        break;
      }
      if (item.publishedAt < floor) {
        reachedKnownGround = true;
        break;
      }
      found.push(item);
    }

    if (reachedKnownGround || !nextPageToken) break;
    pageToken = nextPageToken;
  }

  return found;
}

/**
 * Items whose metadata is expected to change under them.
 *
 * A scheduled stream becomes a live one and then an ordinary video, and none
 * of those transitions produce a new upload for the playlist to report. So
 * anything still marked live or upcoming is re-read on every pass, regardless
 * of whether it is new, which is the only way those states ever resolve.
 */
async function refreshableIds(channelId: string): Promise<string[]> {
  const rows = await db
    .select({ youtubeId: signalContent.youtubeId })
    .from(signalContent)
    .where(
      and(
        eq(signalContent.channelId, channelId),
        inArray(signalContent.kind, ['live', 'upcoming']),
      ),
    );
  return rows.map((row) => row.youtubeId);
}

/** Write videos in, without ever touching what the reader decided. */
async function upsertVideos(channelId: string, videos: YouTubeVideo[]): Promise<number> {
  if (videos.length === 0) return 0;

  await db
    .insert(signalContent)
    .values(
      videos.map((video) => ({
        id: newSignalId('vid'),
        youtubeId: video.youtubeId,
        channelId,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        kind: video.kind,
        durationSeconds: video.durationSeconds,
        publishedAt: video.publishedAt,
        scheduledAt: video.scheduledAt,
        startedAt: video.startedAt,
      })),
    )
    .onConflictDoUpdate({
      target: signalContent.youtubeId,
      set: {
        // Facts about the video, which YouTube owns and may revise.
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        thumbnailUrl: sql`excluded.thumbnail_url`,
        kind: sql`excluded.kind`,
        durationSeconds: sql`excluded.duration_seconds`,
        scheduledAt: sql`excluded.scheduled_at`,
        startedAt: sql`excluded.started_at`,
        updatedAt: sql`(unixepoch() * 1000)`,
        // state, snoozed_until and processed_at are absent on purpose. They
        // belong to the reader, and a sync has no business changing them.
      },
    });

  return videos.length;
}

/**
 * Sync one channel.
 *
 * Records the checkpoint only on success. A failed pass leaves the previous
 * checkpoint exactly where it was, so the next attempt asks for the same
 * window again rather than skipping over whatever was missed.
 */
export async function syncChannel(channel: SignalChannel): Promise<SyncResult> {
  const base = { channelId: channel.id, title: channel.title };

  try {
    // The uploads playlist is stable for the life of a channel, so it is read
    // once and kept. A channel added before this was known still gets one.
    let playlistId = channel.uploadsPlaylistId;
    if (!playlistId) {
      const [fresh] = await fetchChannels([channel.youtubeId]);
      playlistId = fresh?.uploadsPlaylistId ?? null;
      if (!playlistId) throw new YouTubeError('This channel exposes no uploads.', 'notFound');
      await db
        .update(signalChannels)
        .set({ uploadsPlaylistId: playlistId })
        .where(eq(signalChannels.id, channel.id));
    }

    const fresh = await collectNewUploads(channel, playlistId);
    const stale = await refreshableIds(channel.id);

    // One list, deduplicated: a live stream that is also new should be fetched
    // once, not twice.
    const wanted = [...new Set([...fresh.map((item) => item.videoId), ...stale])];

    let written = 0;
    for (let index = 0; index < wanted.length; index += 50) {
      const videos = await fetchVideos(wanted.slice(index, index + 50));
      written += await upsertVideos(channel.id, videos);
    }

    const newest = fresh[0]?.videoId ?? channel.lastSeenVideoId;

    await db
      .update(signalChannels)
      .set({
        lastSyncedAt: Date.now(),
        lastSeenVideoId: newest,
        syncStatus: 'ok',
        lastError: null,
        failureCount: 0,
      })
      .where(eq(signalChannels.id, channel.id));

    return { ...base, added: fresh.length, updated: written - fresh.length, ok: true };
  } catch (error) {
    const { message } = humanError(error);

    await db
      .update(signalChannels)
      .set({
        syncStatus: 'error',
        lastError: message,
        failureCount: channel.failureCount + 1,
      })
      .where(eq(signalChannels.id, channel.id));

    return { ...base, added: 0, updated: 0, ok: false, error: message };
  }
}

export interface SyncRun {
  startedAt: number;
  finishedAt: number;
  channels: number;
  added: number;
  errors: number;
  offline: boolean;
  results: SyncResult[];
}

/**
 * Sync every enabled channel, one after another.
 *
 * Sequential on purpose. Twenty channels in parallel would be twenty
 * simultaneous requests to the same API for no gain: the whole pass costs
 * about twenty quota units and a couple of seconds either way, and a burst is
 * the shape of traffic most likely to be rate limited.
 *
 * Being offline stops the run rather than grinding through twenty identical
 * failures and marking every channel broken. One failed connection is enough
 * to know.
 */
export async function syncAll(): Promise<SyncRun> {
  const startedAt = Date.now();

  // Before the baseline there is nothing that qualifies, so the pass is
  // skipped outright rather than spending quota to prove it. The floor in
  // collectNewUploads would return an empty list anyway; this just avoids
  // asking.
  if (beforeBaseline(startedAt)) {
    return {
      startedAt,
      finishedAt: Date.now(),
      channels: 0,
      added: 0,
      errors: 0,
      offline: false,
      results: [],
    };
  }

  const channels = await db.select().from(signalChannels).where(eq(signalChannels.enabled, true));

  const results: SyncResult[] = [];
  let offline = false;

  for (const channel of channels) {
    const result = await syncChannel(channel);
    results.push(result);

    if (result.error === 'No connection to YouTube.') {
      offline = true;
      break;
    }
  }

  return {
    startedAt,
    finishedAt: Date.now(),
    channels: results.length,
    added: results.reduce((total, r) => total + r.added, 0),
    errors: results.filter((r) => !r.ok).length,
    offline,
    results,
  };
}
