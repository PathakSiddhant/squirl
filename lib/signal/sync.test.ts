import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { installFakeYouTube, useTempDatabase, type FakeYouTube } from './testing';

const MINUTE = 60_000;

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
});
