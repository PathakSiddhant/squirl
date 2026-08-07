import { addDays, addMonths, type DayString } from '../date';
import type { IntervalUnit } from '../db/schema';

/**
 * When a repeating charge falls due.
 *
 * The whole module exists to get one thing right: occurrences are derived from
 * the original start date, never by stepping the previous date forward. A plan
 * billed on the 31st would otherwise land on 28 February and then stay on the
 * 28th forever. Deriving from the start gives 31 Jan, 28 Feb, 31 Mar, which is
 * what the bank actually does.
 */

export interface Schedule {
  startsOn: DayString;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  endsOn?: DayString | null;
}

/** The date of the nth occurrence, counting the first billing as index 0. */
export function occurrenceOn(schedule: Schedule, index: number): DayString {
  const step = schedule.intervalCount * index;

  switch (schedule.intervalUnit) {
    case 'day':
      return addDays(schedule.startsOn, step);
    case 'week':
      return addDays(schedule.startsOn, step * 7);
    case 'month':
      return addMonths(schedule.startsOn, step);
    case 'year':
      return addMonths(schedule.startsOn, step * 12);
  }
}

/** True once the schedule has run past its end date. */
export function hasEnded(schedule: Schedule, index: number): boolean {
  if (!schedule.endsOn) return false;
  return occurrenceOn(schedule, index) > schedule.endsOn;
}

/**
 * Occurrence dates that are due on or before `asOf` and have not been posted.
 *
 * Catch-up is deliberate: if the laptop was off for three weeks, three weekly
 * charges really did leave the account, and the ledger has to record all of
 * them rather than only the latest.
 *
 * `limit` guards against a rule with a start date years in the past generating
 * thousands of rows in one go.
 */
export function duePostings(
  schedule: Schedule,
  postedCount: number,
  asOf: DayString,
  limit = 60,
): DayString[] {
  const out: DayString[] = [];

  for (let index = postedCount; out.length < limit; index += 1) {
    if (hasEnded(schedule, index)) break;
    const day = occurrenceOn(schedule, index);
    if (day > asOf) break;
    out.push(day);
  }

  return out;
}

/** The next date this will charge, or null once it is finished. */
export function nextDueOn(schedule: Schedule, postedCount: number): DayString | null {
  if (hasEnded(schedule, postedCount)) return null;
  return occurrenceOn(schedule, postedCount);
}

/** "every month", "every 3 months", "every 2 weeks", "every year". */
export function describeInterval(unit: IntervalUnit, count: number): string {
  const plural = `${unit}s`;
  if (count === 1) return `every ${unit}`;
  return `every ${count} ${plural}`;
}

/**
 * What a repeating charge costs over a year, so a monthly plan and an annual
 * one can be compared without doing arithmetic in your head.
 */
export function yearlyCost(amount: number, unit: IntervalUnit, count: number): number {
  const perYear = { day: 365, week: 52, month: 12, year: 1 }[unit] / count;
  return Math.round(amount * perYear);
}

/** Common shapes, offered as one-tap presets rather than two fiddly inputs. */
export const INTERVAL_PRESETS: Array<{
  label: string;
  unit: IntervalUnit;
  count: number;
}> = [
  { label: 'Monthly', unit: 'month', count: 1 },
  { label: 'Every 3 months', unit: 'month', count: 3 },
  { label: 'Every 6 months', unit: 'month', count: 6 },
  { label: 'Yearly', unit: 'year', count: 1 },
  { label: 'Weekly', unit: 'week', count: 1 },
  { label: 'Every 2 weeks', unit: 'week', count: 2 },
];
