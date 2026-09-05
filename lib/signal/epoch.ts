/**
 * Signal's baseline: the moment tracking begins.
 *
 * 6 September 2026, 05:00 IST. Nothing published before this instant is ever
 * imported, on any sync, ever. The reader is clearing an existing YouTube
 * backlog by hand and wants Signal to start empty rather than inheriting it,
 * and a queue that opens with four hundred unread items is the exact thing
 * this product exists to prevent.
 *
 * This is a floor in the sync engine rather than a filter on a screen. The
 * difference matters: a filter leaves the rows in the database, so they surface
 * the moment anything queries without it, and "how far back does this go"
 * becomes a property of whichever query you happened to write. A floor means
 * those rows are never written down at all, and the starting point is a fact
 * about the data rather than a habit of the interface.
 *
 * Stored as a UTC instant because that is what it is. 05:00 IST is 23:30 UTC
 * on the previous day, and writing it in the timezone it will be compared in
 * avoids a conversion at every call site.
 */
export const SIGNAL_EPOCH = Date.UTC(2026, 8, 5, 23, 30, 0);

/** True while the baseline is still in the future and there is nothing to sync yet. */
export function beforeBaseline(now: number = Date.now()): boolean {
  return now < SIGNAL_EPOCH;
}

/** How long until tracking starts. Zero once it has. */
export function untilBaseline(now: number = Date.now()): number {
  return Math.max(0, SIGNAL_EPOCH - now);
}
