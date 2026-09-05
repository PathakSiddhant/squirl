import { z } from 'zod';

import { keyCount, nextKey, releaseKey, restKey } from './keys';

/**
 * The only place in Signal that talks to YouTube.
 *
 * Everything crossing this boundary is parsed before it is believed. YouTube's
 * responses are public strings written by strangers, and titles containing
 * angle brackets, descriptions containing scripts and thumbnails pointing
 * anywhere are all normal. Nothing here is trusted as markup, and every URL is
 * checked to be an https URL on a host we expect before it is stored.
 *
 * ## Quota, which shapes the whole design
 *
 * Verified against the live API in September 2026. A project gets 10,000 units
 * a day. The costs are not uniform:
 *
 *   channels.list        1 unit
 *   playlistItems.list   1 unit   (up to 50 items)
 *   videos.list          1 unit   (up to 50 ids in one call)
 *   search.list        100 units  and a separate hard cap of 100 calls a day
 *
 * A search costs as much as a hundred playlist reads. That single fact decides
 * the architecture: monitoring never searches. It reads each channel's uploads
 * playlist, which is one unit per channel per pass, so twenty channels every
 * three hours costs about 160 units a day out of ten thousand.
 *
 * Search is spent only when a human is looking for something, and even then
 * only when nothing cheaper will do: a handle, a URL or a raw channel id all
 * resolve through channels.list for one unit instead of a hundred.
 */

const API = 'https://www.googleapis.com/youtube/v3';

/** Hosts YouTube actually serves its images from. Anything else is discarded. */
const IMAGE_HOSTS = new Set(['i.ytimg.com', 'yt3.ggpht.com', 'yt3.googleusercontent.com']);

export class YouTubeError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'quota' | 'auth' | 'notFound' | 'http' | 'malformed',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'YouTubeError';
  }
}

function apiKey(): string {
  const key = nextKey('youtube');
  if (!key) {
    throw new YouTubeError(
      'No YouTube API key is configured. Add YOUTUBE_API_KEYS to .env.local.',
      'auth',
    );
  }
  return key;
}

/**
 * A thumbnail URL, or nothing.
 *
 * Rejects anything that is not https on a known YouTube image host, so a
 * malformed or hostile response cannot get an arbitrary URL into the database
 * and from there into an <img src> on the reader's screen.
 */
function safeImage(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    if (!IMAGE_HOSTS.has(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** YouTube ids are opaque, but they are always this alphabet. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const isId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);

// --------------------------------------------------------------- transport

/**
 * One request, retried across the key pool.
 *
 * A key that reports its quota is gone is rested until the quota day rolls
 * over and the next key is tried, so several free projects behave as one
 * larger allowance and a single exhausted key never stops Signal. Every other
 * failure is returned as it is: retrying a malformed response on a different
 * key would just be malformed again.
 */
async function call<T>(path: string, params: Record<string, string>, shape: z.ZodType<T>): Promise<T> {
  const attempts = Math.max(keyCount('youtube'), 1);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const key = apiKey();
    try {
      const result = await callWith<T>(key, path, params, shape);
      releaseKey('youtube', key);
      return result;
    } catch (error) {
      lastError = error;
      if (error instanceof YouTubeError && error.kind === 'quota') {
        restKey('youtube', key);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new YouTubeError('YouTube could not be reached.', 'http');
}

async function callWith<T>(
  key: string,
  path: string,
  params: Record<string, string>,
  shape: z.ZodType<T>,
): Promise<T> {
  const query = new URLSearchParams({ ...params, key });
  let response: Response;

  try {
    response = await fetch(`${API}/${path}?${query}`, {
      // Signal's own database is the cache. Asking Next to cache these as well
      // would put a second, invisible copy of the truth in the process.
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch (cause) {
    // No response at all: no network, DNS failure, or the request timed out.
    // Not an error in the product's sense, just the state of being offline.
    throw new YouTubeError('Could not reach YouTube.', 'offline');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 403 && /quota/i.test(body)) {
      throw new YouTubeError('The YouTube API quota for today is used up.', 'quota', 403);
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new YouTubeError('YouTube refused the API key.', 'auth', response.status);
    }
    if (response.status === 404) throw new YouTubeError('Not found on YouTube.', 'notFound', 404);
    throw new YouTubeError(`YouTube returned ${response.status}.`, 'http', response.status);
  }

  const parsed = shape.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new YouTubeError('YouTube returned something unexpected.', 'malformed');
  }
  return parsed.data;
}

// ---------------------------------------------------------------- channels

const thumbnails = z
  .object({
    default: z.object({ url: z.string() }).partial().optional(),
    medium: z.object({ url: z.string() }).partial().optional(),
    high: z.object({ url: z.string() }).partial().optional(),
  })
  .partial()
  .optional();

const channelItem = z.object({
  id: z.string(),
  snippet: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      customUrl: z.string().optional(),
      thumbnails,
    })
    .optional(),
  contentDetails: z
    .object({ relatedPlaylists: z.object({ uploads: z.string().optional() }).partial().optional() })
    .optional(),
  statistics: z
    .object({
      subscriberCount: z.string().optional(),
      hiddenSubscriberCount: z.boolean().optional(),
    })
    .optional(),
});

const channelList = z.object({ items: z.array(channelItem).optional() });

export interface YouTubeChannel {
  youtubeId: string;
  title: string;
  handle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  uploadsPlaylistId: string | null;
}

function toChannel(item: z.infer<typeof channelItem>): YouTubeChannel | null {
  if (!isId(item.id) || !item.snippet?.title) return null;

  const subs = item.statistics?.subscriberCount;
  const uploads = item.contentDetails?.relatedPlaylists?.uploads;

  return {
    youtubeId: item.id,
    title: item.snippet.title,
    // customUrl arrives as "@mkbhd". The at sign is presentation, so it is
    // stripped here and added back by whatever renders it.
    handle: item.snippet.customUrl?.replace(/^@/, '') ?? null,
    description: item.snippet.description?.trim() || null,
    thumbnailUrl:
      safeImage(item.snippet.thumbnails?.high?.url) ??
      safeImage(item.snippet.thumbnails?.medium?.url) ??
      safeImage(item.snippet.thumbnails?.default?.url),
    // Hidden counts come back absent; a channel that hides it is not a channel
    // with zero subscribers, so this stays null rather than becoming 0.
    subscriberCount: subs && /^\d+$/.test(subs) ? Number(subs) : null,
    uploadsPlaylistId: isId(uploads) ? uploads : null,
  };
}

/**
 * Look up channels by id. One unit, up to fifty at a time.
 *
 * This is also the enrichment pass after a search: search results carry no
 * handle, no subscriber count and no uploads playlist, and getting all three
 * for fifty channels costs one more unit.
 */
export async function fetchChannels(ids: string[]): Promise<YouTubeChannel[]> {
  const clean = ids.filter(isId).slice(0, 50);
  if (clean.length === 0) return [];

  const data = await call(
    'channels',
    { part: 'snippet,contentDetails,statistics', id: clean.join(','), maxResults: '50' },
    channelList,
  );
  return (data.items ?? []).map(toChannel).filter((c): c is YouTubeChannel => c !== null);
}

/**
 * Resolve one channel from whatever the reader pasted, for a single unit.
 *
 * Handles the four things a person actually has to hand: a bare @handle, a
 * channel URL of either shape, and a raw UC… id. Each of these is an exact
 * identifier, so paying a hundred units to *search* for something we can
 * already name would be waste.
 *
 * Returns null when the identifier is well-formed but matches nothing, because
 * YouTube answers that with 200 and an empty list rather than a 404.
 */
export async function resolveChannel(input: string): Promise<YouTubeChannel | null> {
  const text = input.trim();
  if (!text) return null;

  let handle: string | null = null;
  let id: string | null = null;

  const url = /^https?:\/\//i.test(text) ? safeParseUrl(text) : null;
  if (url) {
    const parts = url.pathname.split('/').filter(Boolean);
    const at = parts.find((p) => p.startsWith('@'));
    if (at) handle = at.slice(1);
    const channelIndex = parts.indexOf('channel');
    if (channelIndex !== -1 && parts[channelIndex + 1]) id = parts[channelIndex + 1];
  } else if (text.startsWith('@')) {
    handle = text.slice(1);
  } else if (/^UC[A-Za-z0-9_-]{20,}$/.test(text)) {
    id = text;
  }

  if (id && isId(id)) {
    const [found] = await fetchChannels([id]);
    return found ?? null;
  }

  if (handle) {
    const data = await call(
      'channels',
      { part: 'snippet,contentDetails,statistics', forHandle: `@${handle}` },
      channelList,
    );
    const item = (data.items ?? [])[0];
    return item ? toChannel(item) : null;
  }

  return null;
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

const searchList = z.object({
  items: z
    .array(
      z.object({
        id: z.object({ channelId: z.string().optional() }).partial().optional(),
      }),
    )
    .optional(),
});

/**
 * Keyword search for channels. A hundred units, and a hundred calls a day.
 *
 * The expensive path, so it is the last resort rather than the front door.
 * Only the ids are read from the result: the snippet it returns is missing the
 * handle, the subscriber count and the uploads playlist anyway, so one extra
 * unit of channels.list gives a complete answer instead of a partial one.
 */
export async function searchChannels(query: string, limit = 8): Promise<YouTubeChannel[]> {
  const q = query.trim();
  if (!q) return [];

  const data = await call(
    'search',
    { part: 'snippet', type: 'channel', q, maxResults: String(Math.min(limit, 25)) },
    searchList,
  );

  const ids = (data.items ?? [])
    .map((item) => item.id?.channelId)
    .filter((id): id is string => isId(id));

  return ids.length > 0 ? fetchChannels(ids) : [];
}

// ----------------------------------------------------------------- uploads

const playlistPage = z.object({
  nextPageToken: z.string().optional(),
  items: z
    .array(
      z.object({
        contentDetails: z
          .object({ videoId: z.string().optional(), videoPublishedAt: z.string().optional() })
          .optional(),
      }),
    )
    .optional(),
});

export interface UploadRef {
  videoId: string;
  publishedAt: number;
}

/**
 * One page of a channel's uploads, newest first.
 *
 * `videoPublishedAt` from contentDetails is used rather than the snippet's
 * `publishedAt`: the snippet reports when the item was added to the playlist,
 * which for an uploads playlist is usually the same thing but is not the
 * property being asked about.
 */
export async function fetchUploadsPage(
  playlistId: string,
  pageToken?: string,
): Promise<{ items: UploadRef[]; nextPageToken?: string }> {
  if (!isId(playlistId)) throw new YouTubeError('Malformed playlist id.', 'malformed');

  const data = await call(
    'playlistItems',
    {
      part: 'contentDetails',
      playlistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    },
    playlistPage,
  );

  const items: UploadRef[] = [];
  for (const item of data.items ?? []) {
    const videoId = item.contentDetails?.videoId;
    const published = item.contentDetails?.videoPublishedAt;
    if (!isId(videoId) || !published) continue;
    const at = Date.parse(published);
    if (Number.isNaN(at)) continue;
    items.push({ videoId, publishedAt: at });
  }

  return { items, nextPageToken: data.nextPageToken };
}

// ------------------------------------------------------------------ videos

const videoList = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z
          .object({
            title: z.string(),
            description: z.string().optional(),
            publishedAt: z.string().optional(),
            liveBroadcastContent: z.string().optional(),
            thumbnails,
          })
          .optional(),
        contentDetails: z.object({ duration: z.string().optional() }).optional(),
        liveStreamingDetails: z
          .object({
            scheduledStartTime: z.string().optional(),
            actualStartTime: z.string().optional(),
            actualEndTime: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export type VideoKind = 'video' | 'short' | 'live' | 'upcoming';

export interface YouTubeVideo {
  youtubeId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  kind: VideoKind;
  durationSeconds: number | null;
  publishedAt: number;
  scheduledAt: number | null;
  startedAt: number | null;
}

/**
 * ISO 8601 duration to seconds. `PT1H2M3S` and every degenerate form of it.
 *
 * Live broadcasts report `P0D`, which parses to zero here and is then treated
 * as "no duration" by the caller, because a stream in progress has no length
 * yet and zero would be a lie rather than an absence.
 */
export function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso);
  if (!match) return null;
  const [, d, h, m, s] = match;
  const total =
    Number(d ?? 0) * 86_400 + Number(h ?? 0) * 3_600 + Number(m ?? 0) * 60 + Math.round(Number(s ?? 0));
  return Number.isFinite(total) ? total : null;
}

/**
 * The longest a video can be and still be called a short.
 *
 * YouTube does not report shortness. A Short is an ordinary video that happens
 * to be brief and vertical, and neither the videos resource nor the playlist
 * item says which. Sixty seconds is the conservative line: it was the original
 * limit and it still catches the overwhelming majority, and being wrong here
 * mislabels an item rather than losing it.
 */
const SHORT_SECONDS = 60;

function classify(
  broadcast: string | undefined,
  duration: number | null,
): VideoKind {
  if (broadcast === 'live') return 'live';
  if (broadcast === 'upcoming') return 'upcoming';
  if (duration !== null && duration > 0 && duration <= SHORT_SECONDS) return 'short';
  return 'video';
}

/**
 * Full metadata for up to fifty videos, in one unit.
 *
 * Batched deliberately. Asking for fifty videos one at a time costs fifty
 * units and fifty round trips to learn exactly the same thing.
 */
export async function fetchVideos(ids: string[]): Promise<YouTubeVideo[]> {
  const clean = ids.filter(isId).slice(0, 50);
  if (clean.length === 0) return [];

  const data = await call(
    'videos',
    { part: 'snippet,contentDetails,liveStreamingDetails', id: clean.join(','), maxResults: '50' },
    videoList,
  );

  const videos: YouTubeVideo[] = [];
  for (const item of data.items ?? []) {
    if (!isId(item.id) || !item.snippet?.title) continue;

    const published = item.snippet.publishedAt ? Date.parse(item.snippet.publishedAt) : NaN;
    if (Number.isNaN(published)) continue;

    const seconds = parseDuration(item.contentDetails?.duration);
    const kind = classify(item.snippet.liveBroadcastContent, seconds);

    const scheduled = item.liveStreamingDetails?.scheduledStartTime;
    const started = item.liveStreamingDetails?.actualStartTime;

    videos.push({
      youtubeId: item.id,
      title: item.snippet.title,
      description: item.snippet.description?.trim().slice(0, 2000) || null,
      thumbnailUrl:
        safeImage(item.snippet.thumbnails?.high?.url) ??
        safeImage(item.snippet.thumbnails?.medium?.url) ??
        safeImage(item.snippet.thumbnails?.default?.url),
      kind,
      // Zero means "in progress", which is an absence rather than a length.
      durationSeconds: seconds && seconds > 0 ? seconds : null,
      publishedAt: published,
      scheduledAt: scheduled ? nullableTime(scheduled) : null,
      startedAt: started ? nullableTime(started) : null,
    });
  }

  return videos;
}

function nullableTime(value: string): number | null {
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}

/** The canonical watch URL. Built here rather than stored, because it is derivable. */
export function watchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;
}

export function channelUrl(youtubeId: string): string {
  return `https://www.youtube.com/channel/${encodeURIComponent(youtubeId)}`;
}

/**
 * The same avatar, at the size it is actually drawn.
 *
 * YouTube hands back an `=s800` variant for every channel. Thirty-eight of
 * those is roughly twenty megabytes of image to fill circles thirty-six pixels
 * across, and while they trickle in the page shows a column of empty rings that
 * reads as broken rather than as loading.
 *
 * The size lives in the URL, so asking for the right one costs nothing: the
 * suffix carries crop and format flags that must be preserved, hence a targeted
 * replacement of the `sNNN` segment rather than rebuilding the string.
 */
export function atSize(url: string | null, px: number): string | null {
  if (!url) return null;
  return url.replace(/=s\d+/, `=s${px}`);
}
