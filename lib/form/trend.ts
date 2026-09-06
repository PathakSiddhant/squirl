import { daysBetween, type DayString } from '@/lib/date';

/**
 * What the weight is actually doing, as distinct from what it said this morning.
 *
 * ## Why a trend at all
 *
 * Day-to-day bodyweight is mostly water, gut contents and salt. Swings of a
 * kilogram overnight are normal and mean nothing, and a product that puts
 * today's reading next to yesterday's and draws an arrow is inviting somebody
 * to react to noise — which is how people end up cutting harder on a Tuesday
 * because of a Monday takeaway.
 *
 * So Form separates the *reading* from the *trend* (§16), shows both, and
 * treats only the second as information about the body.
 *
 * ## Why a regression rather than first-versus-last
 *
 * Subtracting the oldest reading in a window from the newest is entirely at
 * the mercy of which two days happened to be weighed: one salty dinner at
 * either end swings the answer by half a kilo a week. A least-squares slope
 * over every point in the window uses all of them, which is both more stable
 * and more honest about what the whole fortnight said.
 */

export interface Point {
  day: DayString;
  grams: number;
}

export interface Trend {
  /** The most recent reading, whenever it was taken. */
  latest: Point | null;
  /** Smoothed. What to show as "where the body is", rather than the raw value. */
  averageG: number | null;
  /** Grams per week, signed. Negative is downward. */
  ratePerWeekG: number | null;
  direction: 'down' | 'up' | 'flat' | 'unknown';
  /** How many readings the answer rests on, so a screen can decline to boast. */
  samples: number;
}

/** Readings within `days` of the newest one. */
function window(points: Point[], days: number): Point[] {
  if (points.length === 0) return [];
  const newest = points[points.length - 1].day;
  return points.filter((point) => daysBetween(point.day, newest) < days);
}

/**
 * Least-squares slope in grams per day, using real dates as x.
 *
 * Using the date rather than the index is what makes this work on sparse
 * data: three readings taken Monday, Tuesday and the following Sunday are not
 * evenly spaced, and treating them as though they were would distort the rate
 * by a factor of two.
 */
function slopePerDay(points: Point[]): number | null {
  if (points.length < 2) return null;

  const base = points[0].day;
  const xs = points.map((point) => daysBetween(base, point.day));
  const ys = points.map((point) => point.grams);

  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (xs[i] - meanX) * (ys[i] - meanY);
    denominator += (xs[i] - meanX) ** 2;
  }

  // Every reading on the same day: a vertical line has no slope to report.
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Summarise a series.
 *
 * `days` is the window the rate is measured over. Fourteen is the default
 * because it is long enough to outlast a weekend and short enough to notice a
 * change of direction; seven is available for a phase that is moving fast.
 *
 * Expects points sorted ascending by day, which is how the query layer reads
 * them.
 */
export function summarise(points: Point[], days = 14): Trend {
  if (points.length === 0) {
    return { latest: null, averageG: null, ratePerWeekG: null, direction: 'unknown', samples: 0 };
  }

  const recent = window(points, days);
  const latest = points[points.length - 1];

  const averageG =
    recent.length > 0
      ? Math.round(recent.reduce((total, point) => total + point.grams, 0) / recent.length)
      : null;

  const perDay = slopePerDay(recent);
  const ratePerWeekG = perDay === null ? null : Math.round(perDay * 7);

  /*
    A hundred grams a week is inside the noise of a bathroom scale, so anything
    under it is reported as flat rather than as a direction. Claiming a trend
    from thirty grams would be exactly the fake precision §67 rules out.
  */
  const direction: Trend['direction'] =
    ratePerWeekG === null
      ? 'unknown'
      : ratePerWeekG <= -100
        ? 'down'
        : ratePerWeekG >= 100
          ? 'up'
          : 'flat';

  return { latest, averageG, ratePerWeekG, direction, samples: recent.length };
}

/**
 * A smoothed series for drawing.
 *
 * A trailing mean over the window, evaluated at each reading. The line this
 * produces is the one worth looking at; the raw points are drawn behind it,
 * quietly, so the noise is visible without being the subject.
 */
export function smooth(points: Point[], days = 7): Point[] {
  return points.map((point, index) => {
    let total = 0;
    let count = 0;
    for (let i = index; i >= 0; i -= 1) {
      if (daysBetween(points[i].day, point.day) >= days) break;
      total += points[i].grams;
      count += 1;
    }
    return { day: point.day, grams: Math.round(total / Math.max(count, 1)) };
  });
}

/** Mean of whatever is present, ignoring days with nothing recorded. */
export function averageOf(values: Array<number | null | undefined>): number | null {
  const present = values.filter((value): value is number => typeof value === 'number');
  if (present.length === 0) return null;
  return Math.round(present.reduce((a, b) => a + b, 0) / present.length);
}
