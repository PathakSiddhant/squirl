import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  earnedCount,
  evaluateAchievements,
  mascotMood,
  nextMilestone,
  type AchievementStats,
} from './achievements';

const blank: AchievementStats = {
  entryCount: 0,
  streak: 0,
  bestStreak: 0,
  parked: 0,
  netWorth: 0,
  debtsSettled: 0,
  loansClosed: 0,
  reconciliations: 0,
  interestEarned: 0,
  owedByMe: 0,
  loggedDaysLast30: 0,
  distinctCategoriesUsed: 0,
};

const find = (stats: AchievementStats, id: string) =>
  evaluateAchievements(stats).find((a) => a.id === id)!;

test('a brand new ledger has earned nothing', () => {
  const all = evaluateAchievements(blank);
  assert.equal(earnedCount(all), 0);
  assert.ok(all.every((a) => a.progress === 0 || !a.earned));
});

test('"owing nobody" is not handed out for an empty ledger', () => {
  // Zero owed is technically true on day one, but it was not earned.
  assert.equal(find(blank, 'owe-nothing').earned, false);
  assert.equal(find({ ...blank, entryCount: 5 }, 'owe-nothing').earned, true);
  assert.equal(find({ ...blank, entryCount: 5, owedByMe: 100 }, 'owe-nothing').earned, false);
});

test('the first entry earns exactly one milestone', () => {
  const all = evaluateAchievements({ ...blank, entryCount: 1 });
  const earned = all.filter((a) => a.earned).map((a) => a.id);
  assert.deepEqual(earned, ['first-entry', 'owe-nothing']);
});

test('streak milestones read from the best streak, not the current one', () => {
  // A broken streak should not erase a week you already achieved.
  const stats = { ...blank, entryCount: 20, streak: 1, bestStreak: 9 };
  assert.equal(find(stats, 'week-streak').earned, true);
  assert.equal(find(stats, 'month-streak').earned, false);
});

test('progress is reported for unearned milestones', () => {
  const stats = { ...blank, entryCount: 4 };
  const ten = find(stats, 'ten-entries');
  assert.equal(ten.earned, false);
  assert.equal(ten.progress, 0.4);
  assert.equal(ten.progressLabel, '4 of 10 entries');
});

test('progress never exceeds one, and earned items drop their label', () => {
  const stats = { ...blank, entryCount: 500, bestStreak: 400, parked: 99_00_00_000 };
  for (const a of evaluateAchievements(stats)) {
    assert.ok(a.progress <= 1, `${a.id} progress ${a.progress}`);
    if (a.earned) assert.equal(a.progressLabel, null);
  }
});

test('stash tiers unlock in order', () => {
  const at = (parked: number) => evaluateAchievements({ ...blank, entryCount: 1, parked });
  const ids = (parked: number) =>
    at(parked)
      .filter((a) => a.earned && a.id.startsWith('stash'))
      .map((a) => a.id);

  assert.deepEqual(ids(0), []);
  assert.deepEqual(ids(500_000), ['stash-5k']);
  assert.deepEqual(ids(5_000_000), ['stash-5k', 'stash-50k']);
  assert.deepEqual(ids(10_000_000), ['stash-5k', 'stash-50k', 'stash-1l']);
});

test('money progress labels are formatted in rupees, not paise', () => {
  const label = find({ ...blank, parked: 250_000 }, 'stash-5k').progressLabel;
  assert.equal(label, '₹2,500 of ₹5,000');
});

test('nextMilestone picks the closest unearned one', () => {
  const stats = { ...blank, entryCount: 9, bestStreak: 1 };
  const next = nextMilestone(evaluateAchievements(stats));
  assert.equal(next?.id, 'ten-entries', 'nine of ten entries is the nearest goal');
});

test('nextMilestone returns null when everything is earned', () => {
  const maxed: AchievementStats = {
    entryCount: 1000,
    streak: 90,
    bestStreak: 90,
    parked: 20_000_000,
    netWorth: 20_000_000,
    debtsSettled: 3,
    loansClosed: 2,
    reconciliations: 5,
    interestEarned: 5000,
    owedByMe: 0,
    loggedDaysLast30: 30,
    distinctCategoriesUsed: 12,
  };
  const all = evaluateAchievements(maxed);
  assert.equal(earnedCount(all), all.length);
  assert.equal(nextMilestone(all), null);
});

test('the mascot never scolds, and reports the real situation', () => {
  assert.equal(
    mascotMood({ entryCount: 0, safeToSpend: 0, isUnderwater: false, runwayDays: null, streak: 0 }).mood,
    'new',
  );
  assert.equal(
    mascotMood({ entryCount: 9, safeToSpend: 0, isUnderwater: true, runwayDays: 2, streak: 3 }).mood,
    'stretched',
  );
  assert.equal(
    mascotMood({ entryCount: 9, safeToSpend: 100, isUnderwater: false, runwayDays: 3, streak: 3 }).mood,
    'lean',
  );
  assert.equal(
    mascotMood({ entryCount: 9, safeToSpend: 5000, isUnderwater: false, runwayDays: 40, streak: 12 }).mood,
    'thriving',
  );
  assert.equal(
    mascotMood({ entryCount: 9, safeToSpend: 5000, isUnderwater: false, runwayDays: 40, streak: 2 }).mood,
    'steady',
  );

  const words = Object.values(
    mascotMood({ entryCount: 9, safeToSpend: 0, isUnderwater: true, runwayDays: 1, streak: 0 }),
  ).join(' ');
  for (const banned of ['should', 'too much', 'bad', 'overspent', 'stop']) {
    assert.ok(!words.toLowerCase().includes(banned), `mascot must not say "${banned}"`);
  }
});
