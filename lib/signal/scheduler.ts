import { beforeBaseline, untilBaseline } from './epoch';
import { syncAll, type SyncRun } from './sync';

/**
 * Signal's background worker.
 *
 * It lives inside the Squirl process on this machine. There is no cloud
 * scheduler, no hosted cron and no external service: when Squirl is running,
 * the sync is running, and when it is not, nothing is. That is the whole
 * deployment story, and it is the only one compatible with a product whose
 * central promise is that the data never leaves the device.
 *
 * ## Never wait when there is a reason to go now
 *
 * Three hours is the *idle* cadence, not a rate limit. Four things jump the
 * queue, because in each case the schedule is known to be wrong:
 *
 *   the process just started      the machine may have been off for a day
 *   the connection came back      time offline is exactly when things were missed
 *   the app was opened stale      the reader is looking at it right now
 *   the reader asked              they can see the button; it must do something
 *
 * ## Reconnection, without a connectivity API
 *
 * There is no event to subscribe to here, so the failed sync *is* the probe.
 * When a pass fails because the network is gone, the next attempt is scheduled
 * in a minute rather than three hours, backing off gently to ten. The first
 * attempt that succeeds is therefore the reconnect, and because every sync is
 * checkpoint-based it is automatically a catch-up: it asks what has appeared
 * since the last success, which was before the outage began. Nothing published
 * during it is lost, and no separate catch-up path exists to get out of step.
 */

const HOURS = 3_600_000;

/** The idle cadence. Configurable, but not exposed as a setting until it needs to be. */
const INTERVAL = Number(process.env.SIGNAL_SYNC_INTERVAL_MS ?? 3 * HOURS);

/** How soon to try again after a failure, and how far that backs off. */
const RETRY_MIN = 60_000;
const RETRY_MAX = 10 * 60_000;

/** A sync older than this, when the app is opened, is worth redoing on the spot. */
export const STALE_AFTER = INTERVAL;

export interface SchedulerStatus {
  running: boolean;
  /** The last completed run, successful or not. */
  lastRun: SyncRun | null;
  lastSuccessAt: number | null;
  /** True when the last attempt could not reach YouTube. */
  offline: boolean;
  nextRunAt: number | null;
  /** Set while a pass is in flight, so the UI can say "syncing" honestly. */
  syncing: boolean;
  /** Null once tracking has begun. */
  baselineAt: number | null;
}

interface SchedulerState extends SchedulerStatus {
  timer: NodeJS.Timeout | null;
  failures: number;
  /** The in-flight pass, so two triggers cannot run at once. */
  inFlight: Promise<SyncRun> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __signalScheduler: SchedulerState | undefined;
}

/**
 * Held on globalThis for the same reason the database client is: Next replaces
 * the module on every hot reload in development, and a scheduler that is
 * re-created on each edit would leave a fleet of orphaned timers behind, all
 * of them still syncing.
 */
function state(): SchedulerState {
  globalThis.__signalScheduler ??= {
    running: false,
    lastRun: null,
    lastSuccessAt: null,
    offline: false,
    nextRunAt: null,
    syncing: false,
    baselineAt: null,
    timer: null,
    failures: 0,
    inFlight: null,
  };
  return globalThis.__signalScheduler;
}

export function getStatus(): SchedulerStatus {
  const s = state();
  return {
    running: s.running,
    lastRun: s.lastRun,
    lastSuccessAt: s.lastSuccessAt,
    offline: s.offline,
    nextRunAt: s.nextRunAt,
    syncing: s.syncing,
    baselineAt: beforeBaseline() ? Date.now() + untilBaseline() : null,
  };
}

/**
 * Run a pass, or join the one already running.
 *
 * Returning the in-flight promise rather than starting a second pass is what
 * makes every trigger safe to call at any time. The scheduler firing while the
 * reader hits "sync now" produces one sync, not two racing to upsert the same
 * rows.
 */
export function syncNow(): Promise<SyncRun> {
  const s = state();
  if (s.inFlight) return s.inFlight;

  s.syncing = true;
  s.inFlight = syncAll()
    .then((run) => {
      s.lastRun = run;
      s.offline = run.offline;

      if (run.offline) {
        s.failures += 1;
      } else {
        s.failures = 0;
        s.lastSuccessAt = run.finishedAt;
      }
      return run;
    })
    .catch((error) => {
      // syncAll already converts per-channel failures into results, so landing
      // here means something broader broke. It must not kill the scheduler.
      s.failures += 1;
      s.offline = true;
      const run: SyncRun = {
        startedAt: Date.now(),
        finishedAt: Date.now(),
        channels: 0,
        added: 0,
        errors: 1,
        offline: true,
        results: [],
      };
      s.lastRun = run;
      console.error('[signal] sync failed', error);
      return run;
    })
    .finally(() => {
      s.syncing = false;
      s.inFlight = null;
    });

  return s.inFlight;
}

function schedule(delay: number): void {
  const s = state();
  if (s.timer) clearTimeout(s.timer);

  s.nextRunAt = Date.now() + delay;
  s.timer = setTimeout(() => void tick(), delay);
  // Never hold the process open on this alone. If Squirl is otherwise done,
  // a pending sync is not a reason to keep Node alive.
  s.timer.unref?.();
}

async function tick(): Promise<void> {
  const s = state();
  if (!s.running) return;

  // Nothing exists to sync before the baseline, so wait for it rather than
  // spending quota to be told the same thing every three hours.
  if (beforeBaseline()) {
    schedule(Math.min(untilBaseline() + 1_000, INTERVAL));
    return;
  }

  const run = await syncNow();

  // A failed pass retries in a minute, not in three hours. This is the whole
  // of the reconnect mechanism: keep asking, cheaply, until the answer changes.
  const delay = run.offline
    ? Math.min(RETRY_MIN * 2 ** Math.min(s.failures - 1, 4), RETRY_MAX)
    : INTERVAL;

  schedule(delay);
}

/**
 * Start the worker. Safe to call more than once.
 *
 * The first pass is deliberate rather than scheduled: the process starting is
 * itself a reason to sync, because the machine may have been asleep for a day
 * and the checkpoint is the only thing that knows how long.
 */
export function startScheduler(): void {
  const s = state();
  if (s.running) return;

  s.running = true;

  if (beforeBaseline()) {
    const wait = untilBaseline();
    console.log(
      `[signal] tracking begins in ${Math.round(wait / 60_000)} minutes; scheduler idle until then`,
    );
    schedule(wait + 1_000);
    return;
  }

  console.log(`[signal] scheduler started, syncing every ${Math.round(INTERVAL / 60_000)} minutes`);
  // A beat after boot, so the first page load is not competing with a sync for
  // the same event loop.
  schedule(5_000);
}

export function stopScheduler(): void {
  const s = state();
  if (s.timer) clearTimeout(s.timer);
  s.timer = null;
  s.running = false;
  s.nextRunAt = null;
}

/**
 * Sync if the last successful one is old enough to matter.
 *
 * Called when the app is opened. The reader is looking at the screen, so a
 * checkpoint from yesterday is worth acting on immediately rather than at
 * whatever hour the interval happens to land on.
 */
export async function syncIfStale(): Promise<SyncRun | null> {
  const s = state();
  if (beforeBaseline() || s.syncing) return null;

  const last = s.lastSuccessAt;
  if (last !== null && Date.now() - last < STALE_AFTER) return null;

  return syncNow();
}
