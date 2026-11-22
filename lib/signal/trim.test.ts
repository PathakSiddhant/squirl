import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import { installFakeYouTube, useTempDatabase, type FakeYouTube } from './testing';

/** A moment given in IST, so the fixtures read the way the reader would say them. */
const ist = (y: number, month: number, d: number, h = 0, m = 0) =>
  Date.UTC(y, month - 1, d, h, m) - 5.5 * 3_600_000;

const DAY = 86_400_000;

describe('historyCutoff', () => {
  let trim: typeof import('./trim');

  before(async () => {
    trim = await import('./trim');
  });

  const sunday = ist(2026, 11, 22, 12, 6);

  it('keeps today and yesterday for two days, from yesterday’s midnight', () => {
    assert.equal(trim.historyCutoff(2, sunday), ist(2026, 11, 21, 0, 0));
  });

  it('keeps only today for one day', () => {
    assert.equal(trim.historyCutoff(1, sunday), ist(2026, 11, 22, 0, 0));
  });

  it('counts calendar days, so a small hour on Monday still means Sunday and Monday', () => {
    assert.equal(trim.historyCutoff(2, ist(2026, 11, 23, 0, 30)), ist(2026, 11, 22, 0, 0));
  });

  it('reads today in IST, not in the machine’s own timezone', () => {
    // 19:00 UTC on the 22nd is already half past midnight on the 23rd in India.
    assert.equal(trim.historyCutoff(1, Date.UTC(2026, 10, 22, 19, 0)), ist(2026, 11, 23, 0, 0));
  });

  it('refuses a number of days that makes no sense', () => {
    assert.throws(() => trim.historyCutoff(0, sunday));
    assert.throws(() => trim.historyCutoff(1.5, sunday));
  });

  it('turns a named day into its IST midnight, and refuses a malformed one', () => {
    assert.equal(trim.startOfDay('2026-11-21'), ist(2026, 11, 21, 0, 0));
    assert.throws(() => trim.startOfDay('21/11/2026'));
  });
});

describe('trimming the inbox', () => {
  let trim: typeof import('./trim');
  let sync: typeof import('./sync');
  let db: typeof import('@/lib/db/client').db;
  let schema: typeof import('./schema');
  let fake: FakeYouTube;
  let cleanup: () => Promise<void>;

  const PLAYLIST = 'UUchanneltrimtesttttttt';
  const cutoff = ist(2026, 11, 21, 0, 0); // Saturday, as in "keep Saturday and Sunday"

  before(async () => {
    ({ cleanup } = await useTempDatabase());
    trim = await import('./trim');
    sync = await import('./sync');
    schema = await import('./schema');
    ({ db } = await import('@/lib/db/client'));
  });

  beforeEach(async () => {
    await db.delete(schema.signalContent);
    await db.delete(schema.signalChannels);
    await db.delete(schema.signalTracking);
    await db.insert(schema.signalChannels).values({
      id: 'sch_t',
      youtubeId: 'UCchanneltrimtesttttttt',
      uploadsPlaylistId: PLAYLIST,
      title: 'Channel',
    });
    fake = installFakeYouTube();
  });

  afterEach(() => fake.restore());
  after(() => cleanup());

  const put = (
    id: string,
    over: Partial<typeof schema.signalContent.$inferInsert> & { publishedAt: number },
  ) =>
    db.insert(schema.signalContent).values({
      id: `vid_${id}`,
      youtubeId: id,
      channelId: 'sch_t',
      title: id,
      kind: 'video',
      ...over,
    });

  const stateOf = async (id: string) =>
    (await db.select().from(schema.signalContent).where(eq(schema.signalContent.youtubeId, id)))[0];

  /** A spread of everything the rule has an opinion about. */
  async function seed() {
    await put('sat', { publishedAt: ist(2026, 11, 21, 10) });
    await put('sun', { publishedAt: ist(2026, 11, 22, 9) });
    await put('fri', { publishedAt: ist(2026, 11, 20, 23, 30) });
    await put('old', { publishedAt: ist(2026, 11, 5, 12) });
    await put('liveOld', {
      kind: 'live',
      publishedAt: ist(2026, 11, 10, 12),
      startedAt: ist(2026, 11, 10, 12),
    });
    await put('upcomingAhead', {
      kind: 'upcoming',
      publishedAt: ist(2026, 11, 1, 12),
      scheduledAt: ist(2026, 11, 23, 20),
    });
    await put('upcomingStale', {
      kind: 'upcoming',
      publishedAt: ist(2026, 11, 1, 12),
      scheduledAt: ist(2026, 11, 3, 20),
    });
    // Began Friday night and was published, when it ended, on Saturday. The
    // inbox files it under Friday, so the trim must too.
    await put('overnight', {
      publishedAt: ist(2026, 11, 21, 1, 0),
      startedAt: ist(2026, 11, 20, 22, 0),
    });
    // Already dealt with: not waiting, so not the trim's business.
    await put('doneOld', { publishedAt: ist(2026, 11, 5, 9), state: 'done', processedAt: 5 });
    await put('dismissedOld', { publishedAt: ist(2026, 11, 5, 9), state: 'dismissed', processedAt: 6 });
  }

  it('plans to drop what the inbox files before the cutoff, and nothing else', async () => {
    await seed();

    const plan = await trim.planTrim(cutoff);
    const dropped = (await Promise.all(plan.drop.map((d) => d.id))).map((id) => id.replace('vid_', '')).sort();

    assert.equal(plan.waiting, 8);
    assert.deepEqual(dropped, ['fri', 'old', 'overnight', 'upcomingStale']);
  });

  it('keeps a stream that is live, however long ago it began', async () => {
    await seed();
    await trim.applyTrim(await trim.planTrim(cutoff));

    assert.equal((await stateOf('liveOld')).state, 'unseen');
  });

  it('keeps an upcoming stream still ahead, whenever it was announced', async () => {
    await seed();
    await trim.applyTrim(await trim.planTrim(cutoff));

    assert.equal((await stateOf('upcomingAhead')).state, 'unseen');
  });

  it('writes nothing while it is only planning', async () => {
    await seed();
    await trim.planTrim(cutoff);

    const waiting = (await db.select().from(schema.signalContent)).filter((r) => r.state === 'unseen');
    assert.equal(waiting.length, 8);
  });

  it('dismisses exactly the plan, and keeps Saturday and Sunday', async () => {
    await seed();
    const now = ist(2026, 11, 22, 12, 30);

    const dismissed = await trim.applyTrim(await trim.planTrim(cutoff), now);

    assert.equal(dismissed, 4);
    for (const id of ['fri', 'old', 'overnight', 'upcomingStale']) {
      const row = await stateOf(id);
      assert.equal(row.state, 'dismissed', id);
      assert.equal(row.processedAt, now, id);
    }
    for (const id of ['sat', 'sun']) assert.equal((await stateOf(id)).state, 'unseen', id);
  });

  it('leaves what was already decided exactly as it was', async () => {
    await seed();
    await trim.applyTrim(await trim.planTrim(cutoff), ist(2026, 11, 22, 12, 30));

    const done = await stateOf('doneOld');
    const dismissed = await stateOf('dismissedOld');
    assert.deepEqual([done.state, done.processedAt], ['done', 5]);
    assert.deepEqual([dismissed.state, dismissed.processedAt], ['dismissed', 6]);
  });

  it('does nothing the second time', async () => {
    await seed();
    await trim.applyTrim(await trim.planTrim(cutoff));

    const again = await trim.planTrim(cutoff);

    assert.equal(again.drop.length, 0);
    assert.equal(await trim.applyTrim(again), 0);
  });

  it('does not overwrite a decision made between planning and applying', async () => {
    await seed();
    const plan = await trim.planTrim(cutoff);
    // The reader marks one of them done while the plan is on screen.
    await db
      .update(schema.signalContent)
      .set({ state: 'done', processedAt: 99 })
      .where(eq(schema.signalContent.youtubeId, 'old'));

    const dismissed = await trim.applyTrim(plan);

    assert.equal(dismissed, 3);
    assert.deepEqual([(await stateOf('old')).state, (await stateOf('old')).processedAt], ['done', 99]);
  });

  it('handles a backlog longer than one statement can carry', async () => {
    for (let start = 0; start < 1_000; start += 200) {
      await db.insert(schema.signalContent).values(
        Array.from({ length: 200 }, (_, i) => ({
          id: `vid_bulk${start + i}`,
          youtubeId: `bulk${start + i}`,
          channelId: 'sch_t',
          title: 'Old',
          kind: 'video' as const,
          publishedAt: ist(2026, 10, 1, 12) + (start + i),
        })),
      );
    }

    const dismissed = await trim.applyTrim(await trim.planTrim(cutoff));

    assert.equal(dismissed, 1_000);
    assert.equal((await db.select().from(schema.signalContent)).filter((r) => r.state === 'unseen').length, 0);
  });

  it('cannot be undone by a later sync, which is why it dismisses rather than deletes', async () => {
    // A video YouTube still lists, well inside a first sync's thirty days.
    const published = Date.now() - 10 * DAY;
    await put('stillListed', { publishedAt: published });
    await trim.applyTrim(await trim.planTrim(trim.historyCutoff(2)));
    assert.equal((await stateOf('stillListed')).state, 'dismissed');

    fake.setUploads(PLAYLIST, [{ id: 'stillListed', publishedAt: published, title: 'Retitled' }]);
    await sync.syncAll();

    const row = await stateOf('stillListed');
    assert.equal(row.state, 'dismissed', 'the sync saw it again and must not bring it back');
    assert.equal(row.title, 'Retitled', 'its facts are still kept current');
    assert.equal((await db.select().from(schema.signalContent)).length, 1, 'and it was not duplicated');
  });
});
