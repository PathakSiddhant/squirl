import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bmi,
  buildPlan,
  elapsedFraction,
  impliedRate,
  proteinTarget,
  restingEnergy,
  waterTarget,
  weeksAtRate,
  weightProgress,
  type Body,
} from './calc';
import { readDay, rulesFor, targetsOn, judge, type MetricRule } from './day';
import { check, explain } from './feasibility';
import { portion, totals, referenceLabel } from './food';
import { smooth, summarise } from './trend';

const NOW = new Date('2026-09-06T00:00:00Z');

const body = (over: Partial<Body> = {}): Body => ({
  weightG: 104_000,
  heightMm: 1650,
  birthYear: 1996,
  sex: 'male',
  activity: 'light',
  ...over,
});

// ------------------------------------------------------------------- calc

test('resting energy follows Mifflin-St Jeor and reports what it had', () => {
  // 10(104) + 6.25(165) - 5(30) + 5 = 1926
  const full = restingEnergy(body(), NOW);
  assert.equal(full.value, 1926);
  assert.equal(full.basis, 'full');

  // Without a height or a birth year it still answers, and says the answer is
  // built on assumptions rather than on facts.
  const partial = restingEnergy(body({ heightMm: null, birthYear: null }), NOW);
  assert.equal(partial.basis, 'partial');
});

test('an unspecified sex averages the two constants rather than picking one', () => {
  const male = restingEnergy(body({ sex: 'male' }), NOW).value;
  const female = restingEnergy(body({ sex: 'female' }), NOW).value;
  const neither = restingEnergy(body({ sex: 'unspecified' }), NOW).value;
  assert.ok(neither < male && neither > female);
  assert.equal(neither, Math.round((male + female) / 2));
});

test('a rate is compounding, because a percentage of a falling weight falls too', () => {
  // 104 -> 70 at 1% a week is about 39 weeks. Treating 1% as a flat 1.04 kg
  // would say 33, which is the error that makes the end of a long cut feel
  // like failure.
  const weeks = weeksAtRate(104_000, 70_000, 0.01);
  assert.ok(weeks >= 38 && weeks <= 41, `expected ~39, got ${weeks}`);
  assert.ok(weeksAtRate(104_000, 70_000, 0.0075) > weeks);
  assert.equal(weeksAtRate(70_000, 70_000, 0.01), 0);
});

test('protein is set against the lower of current and goal weight', () => {
  // 2 g/kg of 104 kg would be 208 g a day, which is not a target, it is a
  // second job. The goal weight is the better proxy for lean mass.
  assert.equal(proteinTarget(104_000, 70_000, 'cut'), 140_000);
  // Bulking, the current weight is the lower of the two and so the basis.
  assert.equal(proteinTarget(70_000, 78_000, 'lean-bulk'), 125_000);
});

test('water scales with mass and lands on a number that looks like a decision', () => {
  assert.equal(waterTarget(72_000), 2500);
  assert.equal(waterTarget(104_000), 3600);
  // Clamped at both ends rather than extrapolated to nonsense.
  assert.equal(waterTarget(30_000), 1500);
});

test('a plan rounds to figures that admit they are intentions', () => {
  const plan = buildPlan({ body: body(), targetWeightG: 70_000, weeks: 52, kind: 'cut' }, NOW);
  // 1926 * 1.375 = 2648 maintenance, less a deficit for ~654 g a week.
  assert.equal(plan.maintenance, 2648);
  assert.equal(plan.energy % 10_000, 0, 'calories land on a multiple of ten');
  assert.equal(plan.protein % 5_000, 0, 'protein lands on a multiple of five grams');
  assert.equal(plan.water % 100, 0, 'water lands on a multiple of a hundred millilitres');
  assert.ok(plan.energy < plan.maintenance * 1000, 'a cut eats under maintenance');
  assert.equal(plan.heldAtFloor, false);
});

test('maintenance means maintenance, not a very slow cut', () => {
  const plan = buildPlan(
    { body: body({ weightG: 72_000 }), targetWeightG: 72_000, weeks: 12, kind: 'maintenance' },
    NOW,
  );
  assert.equal(plan.adjustment, 0);
  // Landing on a multiple of ten is the point, so the target is maintenance
  // rounded rather than maintenance to the calorie.
  assert.equal(plan.energy % 10_000, 0);
  assert.ok(Math.abs(plan.energy / 1000 - plan.maintenance) <= 5);
});

test('a plan is held at the floor rather than recommending a number it should not', () => {
  const plan = buildPlan({ body: body(), targetWeightG: 70_000, weeks: 8, kind: 'cut' }, NOW);
  assert.equal(plan.heldAtFloor, true);
  assert.equal(plan.energy, 1_500_000, 'held at the male floor of 1500 kcal');
});

test('bmi needs a height and says nothing without one', () => {
  assert.equal(bmi(71_800, 1650), 26.4);
  assert.equal(bmi(71_800, null), null);
});

test('progress through a phase is measured two different ways on purpose', () => {
  // Time elapsed and distance covered are different questions, and a phase
  // that is 60% through the calendar but 20% through the weight is exactly the
  // situation worth being able to see.
  assert.equal(elapsedFraction('2026-09-01', '2026-09-11', '2026-09-06'), 0.5);
  assert.equal(weightProgress(104_000, 87_000, 70_000), 0.5);
  // Overshoot and reversal are real things that happened, so neither is clamped.
  assert.equal(weightProgress(104_000, 68_000, 70_000)! > 1, true);
  assert.equal(weightProgress(104_000, 106_000, 70_000)! < 0, true);
});

// ------------------------------------------------------------ feasibility

test('the spec example is judged out of reach, and offers a real alternative', () => {
  // 104 kg to 70 kg in three months, the exact case in §7.
  const result = check(body(), 70_000, 13, 'cut', NOW);
  assert.equal(result.verdict, 'unrealistic');
  assert.equal(result.direction, 'loss');
  assert.ok(result.rate > 0.02, 'over two percent of bodyweight a week');
  assert.ok(result.fastestSaneWeeks >= 35 && result.fastestSaneWeeks <= 45);
  assert.ok(result.comfortableWeeks > result.fastestSaneWeeks);
});

test('the same goal over a sane timeline is not warned about', () => {
  const result = check(body(), 70_000, 52, 'cut', NOW);
  assert.ok(
    result.verdict === 'comfortable' || result.verdict === 'ambitious',
    `expected a calm verdict, got ${result.verdict}`,
  );
});

test('gain is judged on a slower scale than loss', () => {
  // Half a kilo a week is unremarkable on a cut and fast on a bulk, because
  // tissue is built more slowly than it is lost.
  const losing = check(body({ weightG: 80_000 }), 74_000, 12, 'cut', NOW);
  const gaining = check(body({ weightG: 80_000 }), 86_000, 12, 'lean-bulk', NOW);
  assert.ok(
    ['comfortable', 'ambitious'].includes(losing.verdict),
    `loss at this pace should be calm, got ${losing.verdict}`,
  );
  assert.ok(
    ['aggressive', 'unrealistic'].includes(gaining.verdict),
    `gain at this pace should be flagged, got ${gaining.verdict}`,
  );
});

test('holding steady has no rate to be unreasonable about', () => {
  const result = check(body({ weightG: 72_000 }), 72_000, 12, 'maintenance', NOW);
  assert.equal(result.verdict, 'none');
  assert.match(explain(result), /Holding steady/);
});

test('every verdict has a sentence, and none of them are about the reader', () => {
  for (const weeks of [8, 13, 26, 40, 60]) {
    const sentence = explain(check(body(), 70_000, weeks, 'cut', NOW));
    assert.ok(sentence.length > 20, 'says something');
    assert.doesNotMatch(sentence, /\byou (?:are|were) (?:being )?(?:unrealistic|lazy|greedy)\b/i);
    assert.doesNotMatch(sentence, /fail/i);
  }
});

// -------------------------------------------------------------------- day

const rule = (over: Partial<MetricRule>): MetricRule => ({
  metric: 'protein',
  enabled: true,
  target: 130_000,
  direction: 'at-least',
  ...over,
});

test('a floor is met the moment it is reached, even mid-day', () => {
  assert.equal(judge({ value: 130_000, untracked: false }, 130_000, 'at-least', false), 'met');
  assert.equal(judge({ value: 118_000, untracked: false }, 130_000, 'at-least', false), 'open');
  assert.equal(judge({ value: 118_000, untracked: false }, 130_000, 'at-least', true), 'missed');
});

test('a ceiling is not met until the day has stopped running', () => {
  // Nine in the morning, nothing eaten: calories are not "met", they are
  // simply not yet spent. Marking that green would make the graph a lie.
  assert.equal(judge({ value: 400_000, untracked: false }, 1_800_000, 'at-most', false), 'open');
  assert.equal(judge({ value: 400_000, untracked: false }, 1_800_000, 'at-most', true), 'met');
  // Over the ceiling is over it, whatever time it is.
  assert.equal(judge({ value: 2_000_000, untracked: false }, 1_800_000, 'at-most', false), 'missed');
});

test('unknown is never counted as missed', () => {
  assert.equal(judge({ value: null, untracked: true }, 1_800_000, 'at-most', true), 'untracked');
});

test('a day where every target was met reads as complete', () => {
  const verdict = readDay({
    settled: true,
    rules: [
      rule({ metric: 'protein', target: 130_000, direction: 'at-least' }),
      rule({ metric: 'water', target: 2700, direction: 'at-least' }),
      rule({ metric: 'energy', target: 1_800_000, direction: 'at-most' }),
    ],
    readings: {
      protein: { value: 131_000, untracked: false },
      water: { value: 2800, untracked: false },
      energy: { value: 1_740_000, untracked: false },
    },
  });
  assert.equal(verdict.status, 'complete');
  assert.equal(verdict.fraction, 1);
});

test('a mixed day is partial, and partial is never failure', () => {
  const verdict = readDay({
    settled: true,
    rules: [
      rule({ metric: 'protein', target: 130_000, direction: 'at-least' }),
      rule({ metric: 'water', target: 2700, direction: 'at-least' }),
      rule({ metric: 'creatine', target: 1, direction: 'at-least' }),
    ],
    readings: {
      protein: { value: 131_000, untracked: false },
      water: { value: 1200, untracked: false },
      creatine: { value: 1, untracked: false },
    },
  });
  assert.equal(verdict.status, 'partial');
  assert.equal(verdict.met, 2);
  assert.equal(verdict.judged, 3);
  // The graph shades by how much of the day landed, so a two-of-three day is
  // visibly different from a nothing day. There is no failure state at all.
  assert.ok(verdict.fraction !== null && verdict.fraction > 0.6);
});

test('a day nobody logged is untracked, not a day of zeroes', () => {
  const verdict = readDay({
    settled: true,
    rules: [rule({ metric: 'protein' }), rule({ metric: 'water', target: 2700 })],
    readings: {},
  });
  assert.equal(verdict.status, 'untracked');
  assert.equal(verdict.met, 0);
});

test('a day the reader marked unknown keeps whatever else it knows', () => {
  // Breakfast and lunch tracked, then dinner out with friends. §34: the day
  // does not erase what it knows, and it is not scored as a miss.
  const verdict = readDay({
    settled: true,
    rules: [
      rule({ metric: 'energy', target: 1_800_000, direction: 'at-most' }),
      rule({ metric: 'water', target: 2700, direction: 'at-least' }),
      rule({ metric: 'creatine', target: 1, direction: 'at-least' }),
    ],
    readings: {
      energy: { value: null, untracked: true },
      water: { value: 2800, untracked: false },
      creatine: { value: 1, untracked: false },
    },
  });
  assert.equal(verdict.statuses.energy, 'untracked');
  assert.equal(verdict.untracked, 1);
  assert.equal(verdict.met, 2);
  assert.equal(verdict.judged, 2, 'the unknown metric is not judged at all');
  assert.equal(verdict.status, 'complete', 'what was known was all met');
});

test('a disabled metric leaves no trace in the judgement', () => {
  const verdict = readDay({
    settled: true,
    rules: [
      rule({ metric: 'protein', target: 130_000 }),
      rule({ metric: 'carbs', target: 200_000, enabled: false }),
    ],
    readings: { protein: { value: 140_000, untracked: false } },
  });
  assert.equal(verdict.judged, 1);
  assert.equal(verdict.statuses.carbs, undefined);
  assert.equal(verdict.status, 'complete');
});

test('weight never counts toward whether a day was complete', () => {
  // It is a measurement of the body, not a thing done with the day, and
  // counting it would make every day before the last one partial.
  const verdict = readDay({
    settled: true,
    rules: [
      rule({ metric: 'weight', target: 70_000, direction: 'at-most' }),
      rule({ metric: 'water', target: 2700 }),
    ],
    readings: {
      weight: { value: 104_000, untracked: false },
      water: { value: 2800, untracked: false },
    },
  });
  assert.equal(verdict.judged, 1);
  assert.equal(verdict.status, 'complete');
});

test('a day is judged against the target that was in force when it happened', () => {
  // §61. Monday was lived against 1800; the target moved on Thursday; Monday
  // must still be read against 1800 forever.
  const history = [
    { metric: 'energy' as const, target: 1_800_000, direction: 'at-most' as const, effectiveFrom: '2026-09-01' },
    { metric: 'energy' as const, target: 1_900_000, direction: 'at-most' as const, effectiveFrom: '2026-09-04' },
  ];
  assert.equal(targetsOn(history, '2026-09-02').get('energy')?.target, 1_800_000);
  assert.equal(targetsOn(history, '2026-09-05').get('energy')?.target, 1_900_000);
  // A day before any target existed falls back to nothing rather than the
  // earliest one, because that target genuinely was not in force yet.
  assert.equal(targetsOn(history, '2026-08-30').size, 0);

  const rules = rulesFor(
    [{ metric: 'energy', enabled: true, direction: 'at-most', target: 1_900_000 }],
    history,
    '2026-09-02',
  );
  assert.equal(rules[0].target, 1_800_000, 'history wins over current configuration');
});

// ------------------------------------------------------------------- food

test('a portion is exact where a float would drift', () => {
  // The case from §26: oats at 393 kcal and 25 g protein per 100 g, at 68.5 g.
  const oats = {
    refQuantity: 100_000,
    refUnit: 'g' as const,
    energyMcal: 393_000,
    proteinMg: 25_000,
    carbsMg: 60_000,
    fatMg: 8_000,
    fiberMg: null,
  };
  const eaten = portion(oats, 68_500);
  assert.equal(eaten.energyMcal, 269_205, '269.205 kcal, exactly');
  assert.equal(eaten.proteinMg, 17_125, '17.125 g of protein, exactly');
  assert.equal(eaten.carbsMg, 41_100);
  assert.equal(eaten.fiberMg, null, 'a nutrient nobody entered stays unknown');
});

test('a food counted per piece scales the same way', () => {
  const banana = {
    refQuantity: 1_000,
    refUnit: 'piece' as const,
    energyMcal: 105_000,
    proteinMg: 1_300,
    carbsMg: null,
    fatMg: null,
    fiberMg: null,
  };
  assert.equal(portion(banana, 2_000).energyMcal, 210_000);
  assert.equal(portion(banana, 500).energyMcal, 52_500);
});

test('a day total carries the weakest confidence on it', () => {
  // One guessed item makes the day's total a guess. Nothing upgrades.
  const day = totals([
    { energyMcal: 269_205, proteinMg: 17_125, carbsMg: 41_100, fatMg: null, fiberMg: null, confidence: 'known' },
    { energyMcal: 600_000, proteinMg: 30_000, carbsMg: null, fatMg: null, fiberMg: null, confidence: 'estimated' },
  ]);
  assert.equal(day.energyMcal, 869_205);
  assert.equal(day.proteinMg, 47_125);
  assert.equal(day.confidence, 'estimated');
  assert.equal(day.carbsMg, 41_100, 'a null does not drag a real figure to zero');
  assert.equal(day.fatMg, null, 'and a column nobody filled stays unknown');
});

test('a reference reads the way it would be written on a packet', () => {
  assert.equal(referenceLabel(100_000, 'g'), 'per 100 g');
  assert.equal(referenceLabel(1_000, 'piece'), 'per piece');
  assert.equal(referenceLabel(30_000, 'g'), 'per 30 g');
});

// ------------------------------------------------------------------ trend

test('a trend is a slope over real dates, not the newest reading minus the oldest', () => {
  // Sparse and noisy, the way a real weight log is.
  const points = [
    { day: '2026-09-01', grams: 104_000 },
    { day: '2026-09-02', grams: 104_600 },
    { day: '2026-09-05', grams: 103_400 },
    { day: '2026-09-08', grams: 103_200 },
  ];
  const trend = summarise(points, 14);
  assert.equal(trend.latest?.grams, 103_200);
  assert.equal(trend.direction, 'down');
  assert.ok(trend.ratePerWeekG! < 0);
  assert.equal(trend.samples, 4);
});

test('noise inside the accuracy of a bathroom scale is reported as flat', () => {
  const points = [
    { day: '2026-09-01', grams: 72_000 },
    { day: '2026-09-04', grams: 72_050 },
    { day: '2026-09-08', grams: 71_990 },
  ];
  assert.equal(summarise(points).direction, 'flat');
});

test('a single reading is a reading, not a trend', () => {
  const trend = summarise([{ day: '2026-09-06', grams: 71_800 }]);
  assert.equal(trend.latest?.grams, 71_800);
  assert.equal(trend.ratePerWeekG, null);
  assert.equal(trend.direction, 'unknown');
});

test('an empty log says nothing rather than zero', () => {
  const trend = summarise([]);
  assert.equal(trend.latest, null);
  assert.equal(trend.averageG, null);
  assert.equal(trend.direction, 'unknown');
});

test('smoothing pulls a spike toward the line without deleting it', () => {
  const points = [
    { day: '2026-09-01', grams: 72_000 },
    { day: '2026-09-02', grams: 72_000 },
    { day: '2026-09-03', grams: 74_000 },
  ];
  const smoothed = smooth(points, 7);
  assert.equal(smoothed[2].grams, 72_667);
  assert.ok(smoothed[2].grams < points[2].grams, 'the spike is damped');
  assert.ok(smoothed[2].grams > points[1].grams, 'but it still moved the line');
});
