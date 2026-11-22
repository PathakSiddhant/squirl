import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import { installFakeYouTube, useTempDatabase, type FakeYouTube } from './testing';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const CHANNEL_A = { id: 'sch_a', youtubeId: 'UCchannelaaaaaaaaaaaaaaaa', playlist: 'UUchannelaaaaaaaaaaaaaaaa' };
const CHANNEL_B = { id: 'sch_b', youtubeId: 'UCchannelbbbbbbbbbbbbbbbb', playlist: 'UUchannelbbbbbbbbbbbbbbbb' };

describe('syncAll', () => {
  let sync: typeof import('./sync');
  let tracking: typeof import('./tracking');
  let db: typeof import('@/lib/db/client').db;
  let schema: typeof import('./schema');
  let fake: FakeYouTube;
  let cleanup: () => Promise<void>;

  const content = () => db.select().from(schema.signalContent);
  const channel = async (id: string) =>
    (await db.select().from(schema.signalChannels)).find((row) => row.id === id)!;

  before(async () => {
    ({ cleanup } = await useTempDatabase());
    sync = await import('./sync');
    tracking = await import('./tracking');
    schema = await import('./schema');
    ({ db } = await import('@/lib/db/client'));
  });

  beforeEach(async () => {
    await db.delete(schema.signalContent);
    await db.delete(schema.signalChannels);
    await db.delete(schema.signalTracking);

    for (const entry of [CHANNEL_A, CHANNEL_B]) {
      await db.insert(schema.signalChannels).values({
        id: entry.id,
        youtubeId: entry.youtubeId,
        uploadsPlaylistId: entry.playlist,
        title: `Channel ${entry.id}`,
      });
    }
    fake = installFakeYouTube();
  });

  afterEach(() => fake.restore());
  after(() => cleanup());

  describe('while paused', () => {
    it('asks YouTube nothing at all', async () => {
      fake.setUploads(CHANNEL_A.playlist, [{ id: 'fresh1', publishedAt: Date.now() - MINUTE }]);
      await tracking.pauseTracking();

      const run = await sync.syncAll();

      assert.equal(run.paused, true);
      assert.equal(run.channels, 0);
      assert.deepEqual(fake.calls, [], 'a paused sync must make no request');
      assert.equal((await content()).length, 0);
    });

    it('reports the pause even when there is no channel to skip', async () => {
      // The per-channel check cannot say anything here, so this is the pass-level
      // guard speaking: a paused sync is paused whatever is on the shelf.
      await db.delete(schema.signalChannels);
      await tracking.pauseTracking();

      const run = await sync.syncAll();

      assert.equal(run.paused, true);
      assert.deepEqual(fake.calls, []);
    });

    it('leaves every channel checkpoint where it was', async () => {
      await tracking.pauseTracking();
      await sync.syncAll();

      for (const entry of [CHANNEL_A, CHANNEL_B]) {
        const row = await channel(entry.id);
        assert.equal(row.lastSyncedAt, null);
        assert.equal(row.lastSeenVideoId, null);
        assert.equal(row.syncStatus, 'never');
      }
    });

    it('writes nothing when the pause lands while a channel is being read', async () => {
      fake.setUploads(CHANNEL_A.playlist, [{ id: 'fresh1', publishedAt: Date.now() - MINUTE }]);
      // The reader clicks pause while the video details are in the air.
      fake.onRequest = async (kind) => {
        if (kind === 'videos') await tracking.pauseTracking();
      };

      const run = await sync.syncAll();

      assert.equal(run.paused, true);
      assert.equal((await content()).length, 0, 'nothing may land after the click');
      assert.equal((await channel(CHANNEL_A.id)).lastSyncedAt, null, 'the interrupted channel is not checkpointed');
    });

    it('does not start the next channel once paused', async () => {
      // Channel A has nothing new, so it finishes cleanly; the pause arrives
      // while it is being read, and channel B must then never be asked about.
      fake.onRequest = async (kind) => {
        if (kind === 'playlistItems') await tracking.pauseTracking();
      };

      const run = await sync.syncAll();

      assert.equal(run.paused, true);
      assert.equal(run.channels, 1);
      assert.equal(
        fake.calls.filter((call) => call.includes(CHANNEL_B.playlist)).length,
        0,
        'the second channel must not be read',
      );
    });
  });

  describe('when not paused', () => {
    it('collects what a channel published', async () => {
      fake.setUploads(CHANNEL_A.playlist, [{ id: 'fresh1', publishedAt: Date.now() - MINUTE }]);

      const run = await sync.syncAll();

      assert.equal(run.paused, false);
      assert.equal(run.channels, 2);
      assert.deepEqual((await content()).map((row) => row.youtubeId), ['fresh1']);
      assert.notEqual((await channel(CHANNEL_A.id)).lastSyncedAt, null);
    });
  });

  describe('after a resume', () => {
    /** The moment the reader clicked Resume, half an hour ago. */
    let resumedAt: number;

    const ids = async () => (await content()).map((row) => row.youtubeId).sort();

    beforeEach(async () => {
      resumedAt = Date.now() - 30 * MINUTE;
      await tracking.pauseTracking(resumedAt - 3 * HOUR);
      await tracking.resumeTracking(resumedAt);
    });

    it('takes only what was published at or after the resume', async () => {
      fake.setUploads(CHANNEL_A.playlist, [
        { id: 'during', publishedAt: resumedAt - 2 * HOUR },
        { id: 'minuteBefore', publishedAt: resumedAt - MINUTE },
        { id: 'after', publishedAt: resumedAt + 10 * MINUTE },
      ]);

      await sync.syncAll();

      assert.deepEqual(await ids(), ['after']);
    });

    it('takes something published at the very moment of the resume', async () => {
      fake.setUploads(CHANNEL_A.playlist, [{ id: 'exact', publishedAt: resumedAt }]);

      await sync.syncAll();

      assert.deepEqual(await ids(), ['exact']);
    });

    it('reports what it really added, not everything it looked at', async () => {
      fake.setUploads(CHANNEL_A.playlist, [
        { id: 'during', publishedAt: resumedAt - 2 * HOUR },
        { id: 'minuteBefore', publishedAt: resumedAt - MINUTE },
        { id: 'after', publishedAt: resumedAt + 10 * MINUTE },
      ]);

      const run = await sync.syncAll();

      assert.equal(run.added, 1, 'three were found and two were refused');
    });

    it('never goes back for what it skipped', async () => {
      fake.setUploads(CHANNEL_A.playlist, [
        { id: 'during', publishedAt: resumedAt - 2 * HOUR },
        { id: 'after', publishedAt: resumedAt + 10 * MINUTE },
      ]);
      await sync.syncAll();

      // A later pass sees the same playlist plus one new upload.
      fake.setUploads(CHANNEL_A.playlist, [
        { id: 'during', publishedAt: resumedAt - 2 * HOUR },
        { id: 'after', publishedAt: resumedAt + 10 * MINUTE },
        { id: 'later', publishedAt: Date.now() - MINUTE },
      ]);
      await sync.syncAll();

      assert.deepEqual(await ids(), ['after', 'later']);
    });

    it('does not catch a channel up across the pause, whatever its checkpoint says', async () => {
      // The checkpoint is from before the pause: exactly the case where an
      // ordinary sync would reach back and fetch everything since.
      await db
        .update(schema.signalChannels)
        .set({ lastSyncedAt: resumedAt - 4 * HOUR, lastSeenVideoId: 'old' })
        .where(eq(schema.signalChannels.id, CHANNEL_A.id));
      fake.setUploads(CHANNEL_A.playlist, [
        { id: 'old', publishedAt: resumedAt - 5 * HOUR },
        { id: 'during1', publishedAt: resumedAt - 3 * HOUR },
        { id: 'during2', publishedAt: resumedAt - 2 * HOUR },
        { id: 'after', publishedAt: resumedAt + 5 * MINUTE },
      ]);

      await sync.syncAll();

      assert.deepEqual(await ids(), ['after']);
    });

    it('keeps refreshing a row it already holds, even one older than the floor', async () => {
      // Live before the pause, ended during it. YouTube now calls it an ordinary
      // video published before the floor, and the row has to say so rather than
      // go on claiming a stream that finished hours ago is live.
      await db.insert(schema.signalContent).values({
        id: 'vid_held',
        youtubeId: 'wasLive',
        channelId: CHANNEL_A.id,
        title: 'Stream',
        kind: 'live',
        publishedAt: resumedAt - 5 * HOUR,
        startedAt: resumedAt - 5 * HOUR,
      });
      fake.setUploads(CHANNEL_A.playlist, [
        { id: 'wasLive', publishedAt: resumedAt - 3 * HOUR, duration: 7_200 },
      ]);

      const run = await sync.syncAll();

      const [row] = await content();
      assert.equal(row.kind, 'video');
      assert.equal(row.durationSeconds, 7_200);
      assert.equal((await content()).length, 1, 'refreshed in place, not duplicated');
      assert.equal(run.added, 0);
      assert.equal(run.results.find((r) => r.channelId === CHANNEL_A.id)?.updated, 1);
    });

    it('still brings in a stream that is yet to come, however long ago it was announced', async () => {
      fake.setUploads(CHANNEL_A.playlist, [
        {
          id: 'soon',
          publishedAt: resumedAt - 2 * 24 * HOUR,
          broadcast: 'upcoming',
          scheduledAt: Date.now() + 3 * HOUR,
        },
      ]);

      await sync.syncAll();

      assert.deepEqual(await ids(), ['soon']);
    });

    it('still brings in a stream that is on the air at the moment of the resume', async () => {
      fake.setUploads(CHANNEL_A.playlist, [
        {
          id: 'onAir',
          publishedAt: resumedAt - HOUR,
          broadcast: 'live',
          startedAt: resumedAt - HOUR,
        },
      ]);

      await sync.syncAll();

      assert.deepEqual(await ids(), ['onAir']);
    });

    it('applies the floor that is in force when the write happens', async () => {
      // A video published a minute ago is in hand when the reader pauses and
      // resumes within the same request. It predates that resume, so it has to
      // be refused even though the pass began under an older floor.
      fake.setUploads(CHANNEL_A.playlist, [{ id: 'inFlight', publishedAt: Date.now() - MINUTE }]);
      fake.onRequest = async (kind) => {
        if (kind !== 'videos') return;
        fake.onRequest = undefined;
        await tracking.pauseTracking();
        await tracking.resumeTracking();
      };

      await sync.syncAll();

      assert.deepEqual(await ids(), []);
    });
  });
});

describe('keep', () => {
  // A pure rule: no database is opened, and importing the engine does not open
  // one either, because the client connects on first query rather than on import.
  let keep: typeof import('./sync').keep;

  before(async () => {
    ({ keep } = await import('./sync'));
  });

  const FLOOR = 1_000_000_000_000;
  const NOW = FLOOR + 10 * HOUR;
  const none = new Set<string>();

  const video = (over: Partial<import('./youtube').YouTubeVideo> = {}): import('./youtube').YouTubeVideo => ({
    youtubeId: 'v1',
    title: 'Title',
    description: null,
    thumbnailUrl: null,
    kind: 'video',
    durationSeconds: 600,
    publishedAt: FLOOR + HOUR,
    scheduledAt: null,
    startedAt: null,
    ...over,
  });

  it('keeps an ordinary video from at or after the floor', () => {
    assert.equal(keep(video({ publishedAt: FLOOR }), none, FLOOR, NOW), true);
    assert.equal(keep(video({ publishedAt: FLOOR + HOUR }), none, FLOOR, NOW), true);
  });

  it('refuses an ordinary video from even a moment before the floor', () => {
    assert.equal(keep(video({ publishedAt: FLOOR - 1 }), none, FLOOR, NOW), false);
  });

  it('refuses a Short, found by kind or by the channel’s Shorts playlist', () => {
    assert.equal(keep(video({ kind: 'short' }), none, FLOOR, NOW), false);
    assert.equal(keep(video(), new Set(['v1']), FLOOR, NOW), false);
  });

  it('keeps a live stream whatever its placeholder date', () => {
    assert.equal(keep(video({ kind: 'live', publishedAt: FLOOR - 50 * HOUR }), none, FLOOR, NOW), true);
  });

  it('keeps an upcoming stream still ahead, and one within the hour of grace', () => {
    const placeholder = FLOOR - 50 * HOUR;
    assert.equal(keep(video({ kind: 'upcoming', publishedAt: placeholder, scheduledAt: NOW + HOUR }), none, FLOOR, NOW), true);
    assert.equal(keep(video({ kind: 'upcoming', publishedAt: placeholder, scheduledAt: NOW - 30 * MINUTE }), none, FLOOR, NOW), true);
  });

  it('refuses an upcoming stream whose time passed more than an hour ago', () => {
    assert.equal(
      keep(video({ kind: 'upcoming', publishedAt: FLOOR - 50 * HOUR, scheduledAt: NOW - 2 * HOUR }), none, FLOOR, NOW),
      false,
    );
  });
});
