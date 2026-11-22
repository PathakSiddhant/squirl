import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { SIGNAL_EPOCH, collectionFloor } from './epoch';
import { useTempDatabase } from './testing';

const HOUR = 3_600_000;

describe('collectionFloor', () => {
  it('is the epoch when nothing has ever been resumed', () => {
    assert.equal(collectionFloor(null), SIGNAL_EPOCH);
  });

  it('is the resume moment once that is later than the epoch', () => {
    const resumed = SIGNAL_EPOCH + 40 * 24 * HOUR;
    assert.equal(collectionFloor(resumed), resumed);
  });

  it('never drops below the epoch, whatever is stored', () => {
    assert.equal(collectionFloor(SIGNAL_EPOCH - HOUR), SIGNAL_EPOCH);
  });
});

describe('tracking', () => {
  let tracking: typeof import('./tracking');
  let reset: () => Promise<void>;
  let cleanup: () => Promise<void>;

  before(async () => {
    ({ cleanup } = await useTempDatabase());
    tracking = await import('./tracking');

    const { db } = await import('@/lib/db/client');
    const { signalTracking } = await import('./schema');
    reset = async () => void (await db.delete(signalTracking));
  });

  beforeEach(() => reset());
  after(() => cleanup());

  it('starts running, with no floor beyond the epoch', async () => {
    assert.deepEqual(await tracking.getTracking(), { pausedAt: null, trackingFrom: null });
    assert.equal(await tracking.isPaused(), false);
  });

  it('records the moment of a pause', async () => {
    const state = await tracking.pauseTracking(1_000);

    assert.equal(state.pausedAt, 1_000);
    assert.equal(state.trackingFrom, null, 'pausing alone must not move the floor');
    assert.equal(await tracking.isPaused(), true);
  });

  it('keeps the original moment when paused twice', async () => {
    await tracking.pauseTracking(1_000);
    const state = await tracking.pauseTracking(9_000);

    assert.equal(state.pausedAt, 1_000);
  });

  it('resumes from the moment of the click, not from the pause', async () => {
    await tracking.pauseTracking(1_000);
    const state = await tracking.resumeTracking(5_000);

    assert.equal(state.pausedAt, null);
    assert.equal(state.trackingFrom, 5_000);
    assert.equal(await tracking.isPaused(), false);
  });

  it('does nothing when resumed without a pause', async () => {
    // The stale-tab case: somebody else already resumed, and this click must
    // not move the floor and swallow what was published in between.
    await tracking.pauseTracking(1_000);
    await tracking.resumeTracking(5_000);
    const state = await tracking.resumeTracking(9_000);

    assert.equal(state.trackingFrom, 5_000);
  });

  it('does nothing when resumed before anything was ever paused', async () => {
    const state = await tracking.resumeTracking(5_000);

    assert.deepEqual(state, { pausedAt: null, trackingFrom: null });
  });

  it('never moves the floor backwards', async () => {
    await tracking.pauseTracking(1_000);
    await tracking.resumeTracking(8_000);
    await tracking.pauseTracking(9_000);
    // A clock that was set back between the two.
    const state = await tracking.resumeTracking(2_000);

    assert.equal(state.trackingFrom, 8_000);
  });

  it('moves the floor forward on every later resume', async () => {
    await tracking.pauseTracking(1_000);
    await tracking.resumeTracking(2_000);
    await tracking.pauseTracking(3_000);
    const state = await tracking.resumeTracking(4_000);

    assert.equal(state.trackingFrom, 4_000);
    assert.equal(state.pausedAt, null);
  });
});
