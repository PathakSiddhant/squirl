import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  describeInterval,
  duePostings,
  hasEnded,
  nextDueOn,
  occurrenceOn,
  yearlyCost,
  type Schedule,
} from './recurring';

const monthly = (startsOn: string, count = 1): Schedule => ({
  startsOn,
  intervalUnit: 'month',
  intervalCount: count,
});

test('a month-end subscription does not drift after a short February', () => {
  // The bug this module exists to prevent: stepping forward from 28 Feb would
  // pin every later charge to the 28th.
  const s = monthly('2026-01-31');
  assert.equal(occurrenceOn(s, 0), '2026-01-31');
  assert.equal(occurrenceOn(s, 1), '2026-02-28');
  assert.equal(occurrenceOn(s, 2), '2026-03-31');
  assert.equal(occurrenceOn(s, 3), '2026-04-30');
  assert.equal(occurrenceOn(s, 4), '2026-05-31');
});

test('a leap February is handled on its own terms', () => {
  const s = monthly('2024-01-31');
  assert.equal(occurrenceOn(s, 1), '2024-02-29');
  assert.equal(occurrenceOn(s, 2), '2024-03-31');
});

test('every unit steps by the right amount', () => {
  assert.equal(occurrenceOn({ startsOn: '2026-08-06', intervalUnit: 'day', intervalCount: 10 }, 2), '2026-08-26');
  assert.equal(occurrenceOn({ startsOn: '2026-08-06', intervalUnit: 'week', intervalCount: 2 }, 3), '2026-09-17');
  assert.equal(occurrenceOn(monthly('2026-08-06', 3), 2), '2027-02-06');
  assert.equal(occurrenceOn({ startsOn: '2026-08-06', intervalUnit: 'year', intervalCount: 1 }, 2), '2028-08-06');
});

test('nothing is due before the first billing date', () => {
  const s = monthly('2026-09-01');
  assert.deepEqual(duePostings(s, 0, '2026-08-31'), []);
  assert.deepEqual(duePostings(s, 0, '2026-09-01'), ['2026-09-01']);
});

test('a laptop that was off for weeks catches every missed charge', () => {
  const s: Schedule = { startsOn: '2026-08-01', intervalUnit: 'week', intervalCount: 1 };
  // Three weeks unseen means three real debits, not one.
  assert.deepEqual(duePostings(s, 0, '2026-08-20'), ['2026-08-01', '2026-08-08', '2026-08-15']);
});

test('already-posted occurrences are never posted twice', () => {
  const s = monthly('2026-01-05');
  assert.deepEqual(duePostings(s, 3, '2026-06-30'), ['2026-04-05', '2026-05-05', '2026-06-05']);
  assert.deepEqual(duePostings(s, 6, '2026-06-30'), []);
});

test('catch-up is capped so an ancient start date cannot flood the ledger', () => {
  const s: Schedule = { startsOn: '2000-01-01', intervalUnit: 'day', intervalCount: 1 };
  assert.equal(duePostings(s, 0, '2026-08-06').length, 60);
  assert.equal(duePostings(s, 0, '2026-08-06', 5).length, 5);
});

test('an end date stops the schedule', () => {
  const s: Schedule = { ...monthly('2026-01-10'), endsOn: '2026-03-31' };
  assert.deepEqual(duePostings(s, 0, '2026-12-31'), ['2026-01-10', '2026-02-10', '2026-03-10']);
  assert.equal(hasEnded(s, 3), true);
  assert.equal(nextDueOn(s, 3), null);
});

test('nextDueOn points at the first unposted occurrence', () => {
  const s = monthly('2026-08-06');
  assert.equal(nextDueOn(s, 0), '2026-08-06');
  assert.equal(nextDueOn(s, 1), '2026-09-06');
  assert.equal(nextDueOn(s, 12), '2027-08-06');
});

test('intervals read like English', () => {
  assert.equal(describeInterval('month', 1), 'every month');
  assert.equal(describeInterval('month', 3), 'every 3 months');
  assert.equal(describeInterval('week', 2), 'every 2 weeks');
  assert.equal(describeInterval('year', 1), 'every year');
});

test('yearly cost makes plans comparable', () => {
  assert.equal(yearlyCost(19900, 'month', 1), 238800); // 199 a month
  assert.equal(yearlyCost(149900, 'year', 1), 149900); // 1499 a year
  assert.equal(yearlyCost(50000, 'month', 3), 200000); // 500 a quarter
  assert.equal(yearlyCost(10000, 'week', 1), 520000);
});
