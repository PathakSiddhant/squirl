import { IST_TIME_ZONE } from '@/lib/date';

/** Which part of the day the desk lamp is set for. */
export type DeskPhase = 'dawn' | 'day' | 'dusk' | 'night';

/**
 * The hour where the owner actually is.
 *
 * Squirl runs on one person's machine, and the light in the room they are
 * sitting in changes through the day, so the surfaces they open do too. It is
 * never announced and there is no control for it: you are meant to feel that
 * you came back at a particular time, not read a label about it.
 *
 * Resolved in Asia/Kolkata on the server rather than from the browser, so it
 * matches the room the machine is in and not whatever timezone a client
 * happens to report.
 */
export function deskPhase(now: Date = new Date()): DeskPhase {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIME_ZONE,
      hour: '2-digit',
      hour12: false,
    }).format(now),
  );

  if (hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 17) return 'day';
  if (hour < 20) return 'dusk';
  return 'night';
}
