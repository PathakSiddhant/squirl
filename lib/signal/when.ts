import { IST_TIME_ZONE, daysBetween, toDay } from '@/lib/date';

const clock = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});
const weekday = new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIME_ZONE, weekday: 'short' });
const date = new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIME_ZONE, day: 'numeric', month: 'short' });

/**
 * A moment, worded to follow "since".
 *
 * Only as much as is needed to place it. Something from this morning is just a
 * time; yesterday says so; within the week it is the weekday, because "Sat" is
 * what somebody remembers; and past that a bare weekday would be ambiguous, so
 * it is the date. All of it in IST, whatever timezone the browser is in, and
 * counted in IST calendar days rather than in 24-hour blocks so that 11pm last
 * night is "yesterday" and not "today".
 */
export function sinceLabel(at: number, now: number = Date.now()): string {
  const time = clock.format(at);
  const gap = daysBetween(toDay(new Date(at)), toDay(new Date(now)));

  if (gap <= 0) return time;
  if (gap === 1) return `yesterday, ${time}`;
  if (gap < 7) return `${weekday.format(at)}, ${time}`;
  return `${date.format(at)}, ${time}`;
}
