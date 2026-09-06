import type { Metric, TargetDirection } from './schema';

/**
 * What a day amounted to.
 *
 * ## The rule that shapes everything here
 *
 * A day has three possible readings and none of them is failure.
 *
 *   complete    every target that was set was met
 *   partial     some were, some were not, or some are unknown
 *   untracked   there is not enough here to say
 *
 * There is deliberately no fourth state for "logged everything and hit
 * nothing". A day where somebody ate out with friends, wrote down what they
 * could, and came up short is a day with real information in it, and a product
 * that answers it with a red square has decided that its own tidiness matters
 * more than the person using it. §35 and §39 are explicit about this, and this
 * file is where those sections are actually enforced — every screen reads its
 * verdict from here rather than deciding for itself.
 *
 * ## Nothing here is hard-coded to a metric
 *
 * Which metrics count comes from the phase's configuration, passed in. Turning
 * carbohydrates off does not hide a column, it removes the metric from the
 * judgement entirely, so a day is measured against exactly what its phase
 * asked for and nothing else (§11, §38).
 */

export type MetricStatus =
  /** Reached the target. */
  | 'met'
  /** Under a floor, or over a ceiling, on a day that is finished. */
  | 'missed'
  /** Deliberately recorded as unknown. Never counted as a miss. */
  | 'untracked'
  /** Still running: a ceiling on a day that has not ended yet. */
  | 'open'
  /** Enabled, but no target set — informational only. */
  | 'untargeted'
  /** Nothing logged, on a day that is finished. */
  | 'blank';

export type DayStatus = 'complete' | 'partial' | 'untracked' | 'future';

export interface MetricRule {
  metric: Metric;
  enabled: boolean;
  target: number | null;
  direction: TargetDirection;
}

export interface DayReading {
  /** Canonical fine units, or null if nothing was logged for this metric. */
  value: number | null;
  /** Recorded as deliberately unknown. */
  untracked: boolean;
}

export interface DayInput {
  rules: MetricRule[];
  readings: Partial<Record<Metric, DayReading>>;
  /**
   * Whether the day is over as far as judgement goes.
   *
   * Today is not settled, and the difference matters for any ceiling: at nine
   * in the morning a calorie target is not "met", it is simply not yet spent,
   * and marking it green would make the whole graph a lie until dinner.
   */
  settled: boolean;
}

export interface DayVerdict {
  status: DayStatus;
  /** Per-metric outcome, for the metrics this phase actually enabled. */
  statuses: Partial<Record<Metric, MetricStatus>>;
  met: number;
  /** How many metrics were in a position to be judged at all. */
  judged: number;
  /** Recorded as unknown rather than missed. */
  untracked: number;
  /**
   * How complete the day was, 0 to 1, or null when nothing could be judged.
   *
   * Drives the intensity of a square on the completion graph. It is a ratio of
   * targets met to targets judged, so a day with three of five is two-fifths
   * lit rather than being binary — which is what stops the graph reading as
   * pass and fail.
   */
  fraction: number | null;
}

/**
 * Judge one metric.
 *
 * `around` allows a tenth either side, which is the honest reading of a target
 * like "roughly this much": nobody eating to a maintenance number means it to
 * four significant figures.
 */
export function judge(
  reading: DayReading | undefined,
  target: number | null,
  direction: TargetDirection,
  settled: boolean,
): MetricStatus {
  if (reading?.untracked) return 'untracked';
  if (target === null) return 'untargeted';

  const value = reading?.value ?? null;
  if (value === null) return settled ? 'blank' : 'open';

  if (direction === 'at-least') return value >= target ? 'met' : settled ? 'missed' : 'open';

  if (direction === 'at-most') {
    if (value > target) return 'missed';
    // Under a ceiling is only an achievement once the day has stopped running.
    return settled ? 'met' : 'open';
  }

  const low = target * 0.9;
  const high = target * 1.1;
  if (value >= low && value <= high) return settled ? 'met' : 'open';
  return settled ? 'missed' : 'open';
}

/** Which metrics roll up from the food log rather than being entered directly. */
const NUTRITION: ReadonlySet<Metric> = new Set(['energy', 'protein', 'carbs', 'fat', 'fiber']);

export function isNutrition(metric: Metric): boolean {
  return NUTRITION.has(metric);
}

/**
 * Weight is never judged.
 *
 * It is a measurement of the body, not a thing done with a day, and a phase
 * target for it is months away rather than due tonight. Including it would
 * make every day before the last one a partial day, which is both useless and
 * quietly demoralising (§15).
 */
const NOT_A_DAILY_GOAL: ReadonlySet<Metric> = new Set(['weight', 'mood']);

export function readDay(input: DayInput): DayVerdict {
  const statuses: Partial<Record<Metric, MetricStatus>> = {};
  let met = 0;
  let judged = 0;
  let untracked = 0;
  let anythingAtAll = false;

  for (const rule of input.rules) {
    if (!rule.enabled) continue;

    const reading = input.readings[rule.metric];
    if (reading && (reading.value !== null || reading.untracked)) anythingAtAll = true;

    const status = judge(reading, rule.target, rule.direction, input.settled);
    statuses[rule.metric] = status;

    if (NOT_A_DAILY_GOAL.has(rule.metric)) continue;

    if (status === 'untracked') untracked += 1;
    if (status === 'met' || status === 'missed' || status === 'blank') {
      judged += 1;
      if (status === 'met') met += 1;
    }
  }

  /*
    Whether anything at all was written down is the first question, and it
    decides between two very different readings of an unmet target.

    On a day with some data, a metric left blank is a gap in a day that was
    being tracked, and it counts against how complete that day was. On a day
    with no data whatsoever, the same blank means only that nobody opened the
    app — and scoring that as a day of missed targets would be the product
    inventing a failure out of an absence, which is the one thing §33 and §37
    are both there to prevent.
  */
  const status: DayStatus = !input.settled
    ? 'future'
    : !anythingAtAll
      ? 'untracked'
      : judged > 0 && met === judged
        ? 'complete'
        : 'partial';

  return {
    status,
    statuses,
    met,
    judged,
    untracked,
    /*
      Null on a day nobody touched, and that is not the same as zero.

      A blank metric still counts toward `judged`, so an untouched day came out
      with a fraction of 0/5 — which the completion graph then drew as a faint
      but real tint, making a month nobody logged look like a month of near
      misses. An absence has no fraction at all.
    */
    fraction: status === 'untracked' ? null : judged > 0 ? met / judged : null,
  };
}

// ------------------------------------------------------- targets over time

export interface TargetAt {
  metric: Metric;
  target: number | null;
  direction: TargetDirection;
  effectiveFrom: string;
}

/**
 * The targets that were actually in force on a given day.
 *
 * This is §61 made mechanical. Monday was lived against 1,800 kcal; the target
 * moved to 1,900 on Thursday; Monday must still be read against 1,800 forever.
 * So completion is never judged against *current* configuration — it is judged
 * against the row whose `effectiveFrom` is the latest one on or before the day
 * in question, which keeps the past meaning what it meant.
 *
 * Expects history sorted ascending by `effectiveFrom`, which is how the query
 * layer reads it.
 */
export function targetsOn(history: TargetAt[], day: string): Map<Metric, TargetAt> {
  const live = new Map<Metric, TargetAt>();
  for (const row of history) {
    if (row.effectiveFrom > day) continue;
    live.set(row.metric, row);
  }
  return live;
}

/** Merge the phase's on/off configuration with the targets in force that day. */
export function rulesFor(
  enabled: Array<{ metric: Metric; enabled: boolean; direction: TargetDirection; target: number | null }>,
  history: TargetAt[],
  day: string,
): MetricRule[] {
  const live = targetsOn(history, day);
  return enabled.map((row) => {
    const historical = live.get(row.metric);
    return {
      metric: row.metric,
      enabled: row.enabled,
      // History wins where it exists; the phase row is the fallback for a
      // metric that has never been changed since the phase began.
      target: historical ? historical.target : row.target,
      direction: historical ? historical.direction : row.direction,
    };
  });
}
