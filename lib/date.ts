/**
 * Every date in Hisaab is a plain `YYYY-MM-DD` day string in IST.
 *
 * The user asked for the day, never the clock, so there are no timestamps in
 * the domain at all. Two rules keep this honest:
 *
 *   1. "Today" is resolved in Asia/Kolkata, not in the server's timezone. A
 *      chai bought at 1am in Delhi belongs to that calendar day in IST.
 *   2. Day arithmetic runs on UTC midnight anchors, so adding a day can never
 *      be bent by a timezone offset or a daylight-saving jump.
 */

export type DayString = string; // YYYY-MM-DD

export const IST_TIME_ZONE = 'Asia/Kolkata';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The current calendar day in IST. */
export function today(): DayString {
  return dayFormatter.format(new Date());
}

/** Converts any Date to the IST calendar day it falls on. */
export function toDay(date: Date): DayString {
  return dayFormatter.format(date);
}

export function isDayString(value: unknown): value is DayString {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(anchor(value));
}

/** UTC-midnight epoch for a day string. Internal arithmetic anchor. */
function anchor(day: DayString): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromAnchor(ms: number): DayString {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${d.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY_MS = 86_400_000;

export function addDays(day: DayString, delta: number): DayString {
  return fromAnchor(anchor(day) + delta * DAY_MS);
}

/** Whole days from `a` to `b`. Positive when `b` is later. */
export function daysBetween(a: DayString, b: DayString): number {
  return Math.round((anchor(b) - anchor(a)) / DAY_MS);
}

export function compareDays(a: DayString, b: DayString): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDay(a: DayString, b: DayString): DayString {
  return a <= b ? a : b;
}

export function maxDay(a: DayString, b: DayString): DayString {
  return a >= b ? a : b;
}

/**
 * Adds calendar months, clamping to the end of the target month.
 * 31 Jan + 1 month is 28 Feb, not 3 March. Loan installments land on real days.
 */
export function addMonths(day: DayString, delta: number): DayString {
  const [y, m, d] = day.split('-').map(Number);
  const totalMonths = (y * 12 + (m - 1)) + delta;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return fromAnchor(Date.UTC(year, month, Math.min(d, lastDay)));
}

/**
 * Months elapsed between two days, as a float, for interest accrual.
 *
 * Counted in calendar months, not in mean-length months. Money lent on the 5th
 * has accrued exactly 1.0 months on the 5th of the next month, whether that
 * month had 28 days or 31. A partial month is prorated across the length of
 * that specific month. Negative when `to` precedes `from`.
 */
export function monthsBetween(from: DayString, to: DayString): number {
  if (from === to) return 0;
  if (to < from) return -monthsBetween(to, from);

  let whole = 0;
  while (addMonths(from, whole + 1) <= to) whole += 1;

  const anniversary = addMonths(from, whole);
  if (anniversary === to) return whole;

  const nextAnniversary = addMonths(from, whole + 1);
  const spanned = daysBetween(anniversary, nextAnniversary);
  const elapsed = daysBetween(anniversary, to);
  return whole + elapsed / spanned;
}

export function startOfMonth(day: DayString): DayString {
  return `${day.slice(0, 7)}-01`;
}

export function endOfMonth(day: DayString): DayString {
  const [y, m] = day.split('-').map(Number);
  return fromAnchor(Date.UTC(y, m, 0));
}

export function monthKey(day: DayString): string {
  return day.slice(0, 7);
}

/** Every day from `from` to `to`, inclusive. */
export function eachDay(from: DayString, to: DayString): DayString[] {
  const out: DayString[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// Weekday index with Monday as 0, matching how the calendar grid is drawn.
export function weekdayIndex(day: DayString): number {
  return (new Date(anchor(day)).getUTCDay() + 6) % 7;
}

export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** "4 Aug" or "4 Aug 2025" when the year differs from the reference day. */
export function formatDay(day: DayString, reference: DayString = today()): string {
  const [y, m, d] = day.split('-').map(Number);
  const base = `${d} ${MONTHS[m - 1]}`;
  return y === Number(reference.slice(0, 4)) ? base : `${base} ${y}`;
}

/** "Mon, 4 Aug" */
export function formatDayLong(day: DayString, reference: DayString = today()): string {
  const weekday = WEEKDAYS[new Date(anchor(day)).getUTCDay()];
  return `${weekday}, ${formatDay(day, reference)}`;
}

/** "August 2025" */
export function formatMonth(day: DayString): string {
  const [y, m] = day.split('-').map(Number);
  const full = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${full[m - 1]} ${y}`;
}

/**
 * How a human refers to a day: "today", "yesterday", "in 3 days", "12 days ago".
 * Falls back to a plain date past a fortnight, where relative wording stops
 * being easier to read than the date itself.
 */
export function formatRelativeDay(day: DayString, reference: DayString = today()): string {
  const delta = daysBetween(reference, day);
  if (delta === 0) return 'today';
  if (delta === 1) return 'tomorrow';
  if (delta === -1) return 'yesterday';
  if (delta > 1 && delta <= 14) return `in ${delta} days`;
  if (delta < -1 && delta >= -14) return `${Math.abs(delta)} days ago`;
  return formatDay(day, reference);
}

/** Days remaining in the current calendar month, counting today. */
export function daysLeftInMonth(day: DayString = today()): number {
  return daysBetween(day, endOfMonth(day)) + 1;
}
