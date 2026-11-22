import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { installFakeYouTube, useTempDatabase, type FakeYouTube } from './testing';

describe('scheduler pause and resume', () => {
  let scheduler: typeof import('./scheduler');
  let tracking: typeof import('./tracking');
  let db: typeof import('@/lib/db/client').db;
  let schema: typeof import('./schema');
  let fake: FakeYouTube;
  let cleanup: () => Promise<void>;

  before(async () => {
    ({ cleanup } = await useTempDatabase());
    scheduler = await import('./scheduler');
    tracking = await import('./tracking');
    schema = await import('./schema');
    ({ db } = await import('@/lib/db/client'));
  });

  beforeEach(async () => {
    await db.delete(schema.signalContent);
    await db.delete(schema.signalChannels);
    await db.delete(schema.signalTracking);
    await db.insert(schema.signalChannels).values({
      id: 'sch_a',
      youtubeId: 'UCchannelaaaaaaaaaaaaaaaa',
      uploadsPlaylistId: 'UUchannelaaaaaaaaaaaaaaaa',
      title: 'Channel a',
    });
    // The scheduler keeps its state on globalThis, so a previous test's last run
    // would otherwise still be there.
    globalThis.__signalScheduler = undefined;
    fake = installFakeYouTube();
  });

  afterEach(() => fake.restore());
  after(() => cleanup());

  it('a paused sync is not recorded as a run, and is not a success', async () => {
    await scheduler.pauseSync();

    const run = await scheduler.syncNow();
    const status = scheduler.getStatus();

    assert.equal(run.paused, true);
    assert.equal(status.lastRun, null, 'nothing was learned, so there is no run to remember');
    assert.equal(status.lastSuccessAt, null, 'and certainly no success to claim');
    assert.equal(status.offline, false);
    assert.deepEqual(fake.calls, []);
  });

  it('reports the pause alongside the scheduler state', async () => {
    assert.equal((await scheduler.getSyncStatus()).pausedAt, null);

    const paused = await scheduler.pauseSync();

    assert.equal((await scheduler.getSyncStatus()).pausedAt, paused.pausedAt);
    assert.notEqual(paused.pausedAt, null);
  });

  it('syncs again, and records it, once resumed', async () => {
    await scheduler.pauseSync();
    await scheduler.resumeSync();

    const run = await scheduler.syncNow();
    const status = scheduler.getStatus();

    assert.equal(run.paused, false);
    assert.equal(status.lastRun?.channels, 1);
    assert.notEqual(status.lastSuccessAt, null);
    assert.equal((await tracking.getTracking()).pausedAt, null);
  });

  it('resuming starts no timer when the scheduler is not running', async () => {
    await scheduler.pauseSync();
    await scheduler.resumeSync();

    assert.equal(scheduler.getStatus().nextRunAt, null);
  });
});
