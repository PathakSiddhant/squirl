import type { Confidence, FoodUnit } from './schema';

/**
 * Food arithmetic.
 *
 * One job, done exactly: a food is described once, per some reference quantity,
 * and then eaten in whatever amount it was actually eaten in. Everything else
 * in Form's nutrition layer is a sum of what this file returns.
 *
 * ## Why the integers matter here specifically
 *
 * This is the multiplication the whole product rests on. Oats at 393 kcal per
 * 100 g, eaten at 68.5 g, is 269.205 kcal. Do that in floats, for five
 * nutrients, three meals a day, then sum the day and average the week, and the
 * error is small but it is *systematic* — and the one thing a food log has to
 * be is arithmetic the reader never has to check.
 *
 * In milli-kcal and milligrams the same calculation is exact:
 * 393000 × 68500 ÷ 100000 = 269205, with no rounding at all until it reaches a
 * screen. Rounding happens once, at display, on a number that is already right.
 */

export interface Nutrients {
  energyMcal: number;
  proteinMg: number;
  carbsMg: number | null;
  fatMg: number | null;
  fiberMg: number | null;
}

export interface Reference extends Nutrients {
  /** Milli-units of `refUnit` that the numbers above describe. */
  refQuantity: number;
  refUnit: FoodUnit;
}

/**
 * Scale a reference to an actual amount.
 *
 * The proportion is applied to each nutrient independently and rounded once,
 * at the end, to the nearest whole milli-unit. Nutrients the food does not
 * carry a figure for stay null rather than becoming zero: a food whose fibre
 * was never entered has unknown fibre, and a day that sums those nulls as
 * zeroes would be reporting a fibre intake nobody measured.
 */
export function portion(reference: Reference, quantity: number): Nutrients {
  const ratio = (value: number) => Math.round((value * quantity) / reference.refQuantity);
  const optional = (value: number | null) => (value === null ? null : ratio(value));

  if (reference.refQuantity <= 0 || quantity < 0) {
    return { energyMcal: 0, proteinMg: 0, carbsMg: null, fatMg: null, fiberMg: null };
  }

  return {
    energyMcal: ratio(reference.energyMcal),
    proteinMg: ratio(reference.proteinMg),
    carbsMg: optional(reference.carbsMg),
    fatMg: optional(reference.fatMg),
    fiberMg: optional(reference.fiberMg),
  };
}

export interface DayTotals extends Nutrients {
  entries: number;
  /**
   * The weakest confidence on the day.
   *
   * A day containing one guessed item is a day whose total is a guess, and
   * saying so is the difference between a log and a story. Nothing upgrades:
   * `known` + `estimated` is `estimated`, never the other way round.
   */
  confidence: Confidence;
}

const CONFIDENCE_RANK: Record<Confidence, number> = { known: 0, estimated: 1, unknown: 2 };

/** Add up a day's food rows. */
export function totals(rows: Array<Nutrients & { confidence: Confidence }>): DayTotals {
  let energyMcal = 0;
  let proteinMg = 0;
  let carbsMg: number | null = null;
  let fatMg: number | null = null;
  let fiberMg: number | null = null;
  let confidence: Confidence = 'known';

  for (const row of rows) {
    energyMcal += row.energyMcal;
    proteinMg += row.proteinMg;
    if (row.carbsMg !== null) carbsMg = (carbsMg ?? 0) + row.carbsMg;
    if (row.fatMg !== null) fatMg = (fatMg ?? 0) + row.fatMg;
    if (row.fiberMg !== null) fiberMg = (fiberMg ?? 0) + row.fiberMg;
    if (CONFIDENCE_RANK[row.confidence] > CONFIDENCE_RANK[confidence]) confidence = row.confidence;
  }

  return { energyMcal, proteinMg, carbsMg, fatMg, fiberMg, entries: rows.length, confidence };
}

/**
 * The reference quantities a new food is most likely to want.
 *
 * Per 100 for anything weighed or poured, per 1 for anything counted. Offered
 * as a default rather than a constraint — a food defined per 30 g scoop is
 * perfectly valid and the field accepts it.
 */
export function defaultReference(unit: FoodUnit): number {
  return unit === 'g' || unit === 'ml' ? 100_000 : 1_000;
}

export const UNIT_LABEL: Record<FoodUnit, string> = {
  g: 'g',
  ml: 'ml',
  piece: 'piece',
  serving: 'serving',
};

/** How the reference reads on a card: "per 100 g", "per piece". */
export function referenceLabel(refQuantity: number, unit: FoodUnit): string {
  const amount = refQuantity / 1000;
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
  if (unit === 'piece' || unit === 'serving') {
    return amount === 1 ? `per ${UNIT_LABEL[unit]}` : `per ${rounded} ${UNIT_LABEL[unit]}s`;
  }
  return `per ${rounded} ${UNIT_LABEL[unit]}`;
}
