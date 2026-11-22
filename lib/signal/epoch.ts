/**
 * Signal's baseline: the moment tracking begins.
 *
 * 6 September 2026, 00:00 IST: midnight at the start of the day Signal began.
 *
 * It was briefly set to 05:00 that morning, so the queue would open clean after
 * the existing YouTube backlog had been cleared by hand. Midnight keeps that
 * intent while letting the night's streams count as part of the first day
 * rather than falling just outside it.
 *
 * Nothing published before this instant is ever imported, on any sync, ever.
 * A queue that opens with four hundred unread items is the exact thing this
 * product exists to prevent.
 *
 * This is a floor in the sync engine rather than a filter on a screen. The
 * difference matters: a filter leaves the rows in the database, so they surface
 * the moment anything queries without it, and "how far back does this go"
 * becomes a property of whichever query you happened to write. A floor means
 * those rows are never written down at all, and the starting point is a fact
 * about the data rather than a habit of the interface.
 *
 * Stored as a UTC instant because that is what it is. Midnight IST is 18:30
 * UTC on the previous day, and writing it in the timezone it will be compared
 * in avoids a conversion at every call site.
 */
export const SIGNAL_EPOCH = Date.UTC(2026, 8, 5, 18, 30, 0);

/**
 * The moment before which nothing is collected right now.
 *
 * The epoch is where tracking began and never moves. `trackingFrom` is where
 * the reader last said "carry on from here" (see `signalTracking`), and it only
 * moves forward, so the later of the two is always the floor. With no resume on
 * record it is the epoch, which is exactly what the sync engine used before a
 * resume existed.
 */
export function collectionFloor(trackingFrom: number | null): number {
  return Math.max(SIGNAL_EPOCH, trackingFrom ?? 0);
}

/** True while the baseline is still in the future and there is nothing to sync yet. */
export function beforeBaseline(now: number = Date.now()): boolean {
  return now < SIGNAL_EPOCH;
}

/** How long until tracking starts. Zero once it has. */
export function untilBaseline(now: number = Date.now()): number {
  return Math.max(0, SIGNAL_EPOCH - now);
}
