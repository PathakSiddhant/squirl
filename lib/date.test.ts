import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  addMonths,
  daysBetween,
  daysLeftInMonth,
  eachDay,
  endOfMonth,
  formatDay,
  formatDayLong,
  formatRelativeDay,
  isDayString,
  monthsBetween,
  startOfMonth,
  today,
  toDay,
  weekdayIndex,
} from './date';

test('today is resolved in IST, not in the host timezone', () => {
  const ist = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  assert.equal(today(), ist);
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
});

test('a late-evening UTC instant is already the next day in IST', () => {
  // 2026-08-03T19:30:00Z is 2026-08-04T01:00 in IST.
  assert.equal(toDay(new Date('2026-08-03T19:30:00Z')), '2026-08-04');
  // and 18:29Z is still the 3rd, since IST is UTC+5:30.
  assert.equal(toDay(new Date('2026-08-03T18:29:00Z')), '2026-08-03');
});

test('day arithmetic survives month and year boundaries', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29'); // leap year
  assert.equal(addDays('2025-02-28', 1), '2025-03-01');
});

test('daysBetween is signed and symmetric', () => {
  assert.equal(daysBetween('2026-08-01', '2026-08-04'), 3);
  assert.equal(daysBetween('2026-08-04', '2026-08-01'), -3);
  assert.equal(daysBetween('2026-08-04', '2026-08-04'), 0);
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1);
});

test('addMonths clamps to the end of a short month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2026-08-15', 3), '2026-11-15');
  assert.equal(addMonths('2026-08-15', -8), '2025-12-15');
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
});

test('month helpers', () => {
  assert.equal(startOfMonth('2026-08-17'), '2026-08-01');
  assert.equal(endOfMonth('2026-08-17'), '2026-08-31');
  assert.equal(endOfMonth('2026-02-05'), '2026-02-28');
  assert.equal(endOfMonth('2024-02-05'), '2024-02-29');
  assert.equal(daysLeftInMonth('2026-08-31'), 1);
  assert.equal(daysLeftInMonth('2026-08-01'), 31);
});

test('monthsBetween counts calendar months exactly on the anniversary', () => {
  assert.equal(monthsBetween('2026-01-01', '2026-01-01'), 0);
  assert.equal(monthsBetween('2026-01-01', '2026-02-01'), 1);
  assert.equal(monthsBetween('2026-01-01', '2026-07-01'), 6);
  // A short February must still be worth exactly one month of interest.
  assert.equal(monthsBetween('2026-01-05', '2026-02-05'), 1);
  assert.equal(monthsBetween('2026-02-05', '2026-03-05'), 1);
  assert.equal(monthsBetween('2026-08-15', '2027-08-15'), 12);
});

test('monthsBetween prorates a partial month and is antisymmetric', () => {
  // Halfway through a 30 day span.
  assert.ok(Math.abs(monthsBetween('2026-04-01', '2026-04-16') - 0.5) < 0.02);
  assert.equal(monthsBetween('2026-07-01', '2026-01-01'), -6);
  assert.ok(monthsBetween('2026-01-01', '2026-01-15') > 0);
  assert.ok(monthsBetween('2026-01-01', '2026-01-15') < 1);
});

test('eachDay is inclusive on both ends', () => {
  assert.deepEqual(eachDay('2026-08-01', '2026-08-03'), ['2026-08-01', '2026-08-02', '2026-08-03']);
  assert.deepEqual(eachDay('2026-08-01', '2026-08-01'), ['2026-08-01']);
  assert.equal(eachDay('2026-01-01', '2026-12-31').length, 365);
});

test('weekdayIndex puts Monday first', () => {
  assert.equal(weekdayIndex('2026-08-03'), 0); // a Monday
  assert.equal(weekdayIndex('2026-08-09'), 6); // the Sunday after
});

test('isDayString rejects malformed and impossible input', () => {
  assert.equal(isDayString('2026-08-04'), true);
  assert.equal(isDayString('2026-8-4'), false);
  assert.equal(isDayString('04-08-2026'), false);
  assert.equal(isDayString(''), false);
  assert.equal(isDayString(20260804), false);
});

test('formatting reads the way a person would say it', () => {
  assert.equal(formatDay('2026-08-04', '2026-08-04'), '4 Aug');
  assert.equal(formatDay('2025-12-25', '2026-08-04'), '25 Dec 2025');
  assert.equal(formatDayLong('2026-08-03', '2026-08-04'), 'Mon, 3 Aug');
  assert.equal(formatRelativeDay('2026-08-04', '2026-08-04'), 'today');
  assert.equal(formatRelativeDay('2026-08-03', '2026-08-04'), 'yesterday');
  assert.equal(formatRelativeDay('2026-08-05', '2026-08-04'), 'tomorrow');
  assert.equal(formatRelativeDay('2026-08-11', '2026-08-04'), 'in 7 days');
  assert.equal(formatRelativeDay('2026-07-28', '2026-08-04'), '7 days ago');
  assert.equal(formatRelativeDay('2026-06-01', '2026-08-04'), '1 Jun');
});
