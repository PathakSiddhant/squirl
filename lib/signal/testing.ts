import { mkdirSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * What Signal's tests stand on: a database that is theirs alone, and a YouTube
 * that is served from memory. Nothing in the application imports this.
 */

// ---------------------------------------------------------------- database

const ROOT = path.join(tmpdir(), 'squirl-test');

/*
  Pointed at a throwaway file the moment this module is imported, not when a
  test asks for it. The application's database client reads `DATABASE_URL` once,
  when it is first imported, and falls back to the real `data/squirl.db` when it
  is unset. A test file that imported anything touching the client before it
  called a setup function would therefore be talking to the reader's actual data,
  and the first version of this did exactly that: it ran a migration against the
  live database, which failed harmlessly only because that database happened to
  be already ahead. Importing this file first, as every test does, makes the safe
  path the only path.
*/
mkdirSync(ROOT, { recursive: true });
const DIR = mkdtempSync(path.join(ROOT, 'db-'));
// Forward slashes: a Windows drive path with backslashes is not a valid file URL.
const TEST_URL = `file:${path.join(DIR, 'test.db').split(path.sep).join('/')}`;
process.env.DATABASE_URL = TEST_URL;

/**
 * Remove what earlier runs could not.
 *
 * On Windows the database file stays locked after the client closes, for longer
 * than a test is worth waiting, so a run's own cleanup is a single best-effort
 * attempt and the folder it could not remove is swept by the next run, once the
 * process that held it has exited. The age check keeps a sweep from touching
 * the folders other test files in this same run are using right now.
 */
async function sweepStale(): Promise<void> {
  for (const entry of readdirSync(ROOT)) {
    const full = path.join(ROOT, entry);
    try {
      if (Date.now() - statSync(full).mtimeMs > 60_000) await rm(full, { recursive: true, force: true });
    } catch {
      // Still held by a run that has not exited. The next sweep gets it.
    }
  }
}

/**
 * Build the throwaway database from the real migrations.
 *
 * Running the migrations rather than hand-writing the tables is deliberate: the
 * schema these tests exercise is the one that will actually ship, and a
 * migration that does not apply cleanly fails here instead of on somebody's
 * machine. Call it once per test file, from a `before`, and import the modules
 * under test with a dynamic `import()` after it.
 */
export async function useTempDatabase(): Promise<{ cleanup: () => Promise<void> }> {
  await sweepStale();

  const { db, DATABASE_URL } = await import('@/lib/db/client');
  if (DATABASE_URL !== TEST_URL) {
    // Nothing has been run yet, so refusing here costs nothing. Carrying on would
    // mean running migrations against whatever this points at.
    throw new Error(
      `The database client is pointed at ${DATABASE_URL}, not the test database. ` +
        'Import ./testing before anything that touches the database.',
    );
  }

  const { migrate } = await import('drizzle-orm/libsql/migrator');
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'lib/db/migrations') });

  return {
    cleanup: async () => {
      globalThis.__squirlClient?.close();
      await rm(DIR, { recursive: true, force: true }).catch(() => {
        // Locked until this process exits. See `sweepStale`.
      });
    },
  };
}

// ------------------------------------------------------------ fake YouTube

export interface FakeVideo {
  id: string;
  /** Epoch milliseconds. */
  publishedAt: number;
  title?: string;
  /** Seconds. Defaults to ten minutes, comfortably not a Short. */
  duration?: number;
  broadcast?: 'none' | 'live' | 'upcoming';
  scheduledAt?: number;
  startedAt?: number;
}

type FakeKind = 'playlistItems' | 'videos' | 'channels';

export interface FakeYouTube {
  /** Every request made, as `kind:playlist-or-ids`, in order. */
  calls: string[];
  /** Replace what one uploads playlist holds. */
  setUploads(playlistId: string, videos: FakeVideo[]): void;
  /** Awaited at the start of every request, before it is answered. */
  onRequest?: (kind: FakeKind) => Promise<void> | void;
  restore(): void;
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * YouTube, served from memory.
 *
 * `youtube.ts` calls the global `fetch`, so replacing that for the length of a
 * test is enough to run the real sync engine end to end with no network and no
 * quota. It answers the three reads Signal makes, with shapes the real parsers
 * accept, and records every request so a test can assert on what was asked as
 * well as on what was written.
 *
 * A key has to exist for the client to attempt a request at all, so this sets a
 * dummy one if the environment has none.
 */
export function installFakeYouTube(initial: Record<string, FakeVideo[]> = {}): FakeYouTube {
  process.env.YOUTUBE_API_KEYS ||= 'test-key';

  const uploads = new Map(Object.entries(initial));
  const realFetch = globalThis.fetch;

  const fake: FakeYouTube = {
    calls: [],
    setUploads: (playlistId, videos) => void uploads.set(playlistId, videos),
    restore: () => {
      globalThis.fetch = realFetch;
    },
  };

  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const kind = url.pathname.split('/').pop() as FakeKind;
    const playlistId = url.searchParams.get('playlistId');
    const ids = url.searchParams.get('id');

    fake.calls.push(`${kind}:${playlistId ?? ids ?? ''}`);
    await fake.onRequest?.(kind);

    if (kind === 'playlistItems') {
      // Newest first, the way a real uploads playlist is read.
      const newestFirst = [...(uploads.get(playlistId ?? '') ?? [])].sort(
        (a, b) => b.publishedAt - a.publishedAt,
      );
      const start = Number(url.searchParams.get('pageToken') ?? 0);
      const page = newestFirst.slice(start, start + 50);
      return json({
        items: page.map((video) => ({
          contentDetails: { videoId: video.id, videoPublishedAt: iso(video.publishedAt) },
        })),
        ...(start + 50 < newestFirst.length ? { nextPageToken: String(start + 50) } : {}),
      });
    }

    if (kind === 'videos') {
      const wanted = new Set((ids ?? '').split(','));
      const everything = [...uploads.values()].flat();
      return json({
        items: everything
          .filter((video) => wanted.has(video.id))
          .map((video) => ({
            id: video.id,
            snippet: {
              title: video.title ?? `Video ${video.id}`,
              description: '',
              publishedAt: iso(video.publishedAt),
              liveBroadcastContent: video.broadcast ?? 'none',
              thumbnails: {},
            },
            contentDetails: { duration: video.broadcast === 'live' ? 'P0D' : `PT${video.duration ?? 600}S` },
            liveStreamingDetails:
              video.scheduledAt || video.startedAt
                ? {
                    ...(video.scheduledAt ? { scheduledStartTime: iso(video.scheduledAt) } : {}),
                    ...(video.startedAt ? { actualStartTime: iso(video.startedAt) } : {}),
                  }
                : undefined,
          })),
      });
    }

    return json({ items: [] });
  }) as typeof fetch;

  return fake;
}
