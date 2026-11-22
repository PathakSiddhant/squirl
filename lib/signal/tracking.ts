import { and, eq, isNotNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';

import { signalTracking } from './schema';

/**
 * Pausing Signal, and what resuming it means.
 *
 * Two rules live here and nowhere else.
 *
 * **A pause is a hard stop.** While `pausedAt` is set the sync engine does not
 * call YouTube at all, scheduled or manual, so nothing is collected from any
 * channel.
 *
 * **A resume is a fresh start, not a catch-up.** Every other path in Signal is
 * checkpoint-based on purpose: after a flight with no signal, the next sync asks
 * what appeared since the last success and nothing is lost. That is the right
 * behaviour for an accident and the wrong one for a decision. Somebody who paused
 * for a week chose not to be told about that week, so resuming moves the
 * collection floor to the moment of the click and anything published before it,
 * even a minute before, is never imported. The checkpoints stay as they were;
 * the floor simply sits above them, so nothing here rewrites a channel's own
 * history.
 *
 * Both states are stored, not remembered. This process restarts whenever the
 * machine does, and a pause that evaporated on reboot would only be a pause
 * until the next power cut.
 */

export interface Tracking {
  /** When syncing was paused, or null while it runs. */
  pausedAt: number | null;
  /** Nothing published before this instant is collected. Null until a resume. */
  trackingFrom: number | null;
}

/** The only row there is. The table's own `check` refuses any other id. */
const ROW = 1;

export async function getTracking(): Promise<Tracking> {
  const [row] = await db.select().from(signalTracking).where(eq(signalTracking.id, ROW));
  return { pausedAt: row?.pausedAt ?? null, trackingFrom: row?.trackingFrom ?? null };
}

export async function isPaused(): Promise<boolean> {
  return (await getTracking()).pausedAt !== null;
}

/**
 * Stop collecting, from this moment.
 *
 * Idempotent, and the original moment wins. A second tab, a double click or a
 * retried request must not push "paused since" forward, because that date is
 * the one thing the reader will look at later to remember how long they have
 * been away. Done in one statement so two racing pauses cannot disagree.
 */
export async function pauseTracking(now: number = Date.now()): Promise<Tracking> {
  await db
    .insert(signalTracking)
    .values({ id: ROW, pausedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: signalTracking.id,
      set: {
        pausedAt: sql`coalesce(${signalTracking.pausedAt}, excluded.paused_at)`,
        updatedAt: now,
      },
    });
  return getTracking();
}

/**
 * Start collecting again, from this moment and no earlier.
 *
 * Only a pause can be resumed. A resume that finds nothing paused changes
 * nothing, and that matters: a stale tab still showing "Resume" ten minutes
 * after another one already did would otherwise move the floor forward and
 * silently swallow ten minutes of real uploads.
 *
 * The floor never moves backwards either. A clock set back by hand or by a dead
 * battery must not reopen a window onto everything published since, which is
 * exactly the backlog this exists to keep out.
 */
export async function resumeTracking(now: number = Date.now()): Promise<Tracking> {
  await db
    .update(signalTracking)
    .set({
      pausedAt: null,
      trackingFrom: sql`max(coalesce(${signalTracking.trackingFrom}, 0), ${now})`,
      updatedAt: now,
    })
    .where(and(eq(signalTracking.id, ROW), isNotNull(signalTracking.pausedAt)));
  return getTracking();
}
