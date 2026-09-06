import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { eachDay, today, type DayString } from '@/lib/date';

import { readDay, rulesFor, isNutrition, type DayReading, type DayVerdict, type MetricRule } from './day';
import { totals, type DayTotals } from './food';
import { newFormId } from './id';
import { targetHistory, type PhaseView } from './phases';
import {
  formDays,
  formEntries,
  formFoodLogs,
  formFoods,
  formWeights,
  type Confidence,
  type FoodUnit,
  type FormFoodLog,
  type Metric,
} from './schema';

/**
 * Reading and writing a day.
 *
 * ## Where a day's numbers come from
 *
 * Two different places, deliberately. Water, creatine, movement and sleep are
 * entered directly and live in `form_entries`. Calories and macros are never
 * entered directly at all — they are the sum of the food rows on that day — so
 * a day's total and the things it is made of cannot drift apart. There is no
 * screen anywhere that lets somebody type "1,850 kcal" over a day that
 * contains three foods adding up to something else.
 *
 * ## Nothing here invents a number
 *
 * A metric with no row is absent, not zero. A day marked untracked stays
 * untracked. Every average in the product skips what it does not know rather
 * than treating an absence as a value, which is the whole of §33.
 */

/** One logged row, exactly as stored. Aliased so callers need not know that. */
export type FoodLogRow = FormFoodLog;

export interface DayView {
  day: DayString;
  /** True when this is the day currently being lived, so ceilings stay open. */
  isToday: boolean;
  rules: MetricRule[];
  readings: Partial<Record<Metric, DayReading>>;
  verdict: DayVerdict;
  nutrition: DayTotals;
  foods: FoodLogRow[];
  weightG: number | null;
  nutritionUntracked: boolean;
  note: string | null;
}

/** Everything one day is, assembled once. */
export async function getDayView(
  day: DayString,
  phase: PhaseView | null,
  reference: DayString = today(),
): Promise<DayView> {
  const [dayRow] = await db.select().from(formDays).where(eq(formDays.day, day));
  const entries = await db.select().from(formEntries).where(eq(formEntries.day, day));
  const [weight] = await db.select().from(formWeights).where(eq(formWeights.day, day));
  const foods = await db
    .select()
    .from(formFoodLogs)
    .where(eq(formFoodLogs.day, day))
    .orderBy(asc(formFoodLogs.loggedAt));

  const nutrition = totals(foods);
  const nutritionUntracked = dayRow?.nutritionUntracked ?? false;

  const history = phase ? await targetHistory(phase.id) : [];
  const rules = phase
    ? rulesFor(
        phase.metrics.map((row) => ({
          metric: row.metric,
          enabled: row.enabled,
          direction: row.direction,
          target: row.target,
        })),
        history,
        day,
      )
    : [];

  const readings = assembleReadings({ entries, weight, nutrition, nutritionUntracked, foods });

  return {
    day,
    isToday: day === reference,
    rules,
    readings,
    verdict: readDay({ rules, readings, settled: day < reference }),
    nutrition,
    foods,
    weightG: weight?.grams ?? null,
    nutritionUntracked,
    note: dayRow?.note ?? null,
  };
}

function assembleReadings(input: {
  entries: Array<{ metric: Metric; value: number | null; untracked: boolean }>;
  weight: { grams: number } | undefined;
  nutrition: DayTotals;
  nutritionUntracked: boolean;
  foods: FoodLogRow[];
}): Partial<Record<Metric, DayReading>> {
  const readings: Partial<Record<Metric, DayReading>> = {};

  for (const entry of input.entries) {
    readings[entry.metric] = { value: entry.value, untracked: entry.untracked };
  }

  if (input.weight) readings.weight = { value: input.weight.grams, untracked: false };

  /*
    Nutrition, rolled up from the food rows.

    A day with no food logged has *no* nutrition reading rather than a reading
    of zero — the difference is what stops an untouched Tuesday from being
    scored as a day of perfect calorie discipline.
  */
  const logged = input.foods.length > 0;
  const nutritionValues: Partial<Record<Metric, number | null>> = {
    energy: logged ? input.nutrition.energyMcal : null,
    protein: logged ? input.nutrition.proteinMg : null,
    carbs: input.nutrition.carbsMg,
    fat: input.nutrition.fatMg,
    fiber: input.nutrition.fiberMg,
  };

  for (const [metric, value] of Object.entries(nutritionValues) as Array<[Metric, number | null]>) {
    readings[metric] = { value, untracked: input.nutritionUntracked };
  }

  return readings;
}

// ------------------------------------------------------------------ writes

async function ensureDay(day: DayString, phaseId: string | null): Promise<void> {
  await db.insert(formDays).values({ day, phaseId }).onConflictDoNothing();
}

/** Set a directly-logged metric. Passing null clears it back to unknown. */
export async function setEntry(
  day: DayString,
  metric: Metric,
  value: number | null,
  phaseId: string | null,
  untracked = false,
): Promise<void> {
  await ensureDay(day, phaseId);
  const stamp = Date.now();

  await db
    .insert(formEntries)
    .values({ id: newFormId('fen'), day, metric, value, untracked, createdAt: stamp, updatedAt: stamp })
    .onConflictDoUpdate({
      target: [formEntries.day, formEntries.metric],
      set: { value, untracked, updatedAt: stamp },
    });
}

/**
 * Add to a running metric rather than replacing it.
 *
 * Water is the reason this exists: it arrives a glass at a time, and a control
 * that made somebody compute 1,850 + 250 before typing the answer would be a
 * control nobody used twice (§20).
 */
export async function addToEntry(
  day: DayString,
  metric: Metric,
  delta: number,
  phaseId: string | null,
): Promise<number> {
  await ensureDay(day, phaseId);
  const [existing] = await db
    .select()
    .from(formEntries)
    .where(and(eq(formEntries.day, day), eq(formEntries.metric, metric)));

  const next = Math.max((existing?.value ?? 0) + delta, 0);
  await setEntry(day, metric, next, phaseId, false);
  return next;
}

export async function clearEntry(day: DayString, metric: Metric): Promise<void> {
  await db.delete(formEntries).where(and(eq(formEntries.day, day), eq(formEntries.metric, metric)));
}

/** One reading per day. Weighing twice is correcting, not recording twice. */
export async function logWeight(
  day: DayString,
  grams: number,
  phaseId: string | null,
): Promise<void> {
  await ensureDay(day, phaseId);
  await db
    .insert(formWeights)
    .values({ id: newFormId('fwt'), day, grams })
    .onConflictDoUpdate({ target: formWeights.day, set: { grams } });
}

export async function clearWeight(day: DayString): Promise<void> {
  await db.delete(formWeights).where(eq(formWeights.day, day));
}

/**
 * "I could not track today."
 *
 * Marks the day's nutrition as deliberately unknown without removing a single
 * food row: breakfast and lunch stay exactly as they were logged, and the day
 * simply stops claiming to be a complete account of what was eaten (§34).
 */
export async function setNutritionUntracked(
  day: DayString,
  untracked: boolean,
  phaseId: string | null,
): Promise<void> {
  await ensureDay(day, phaseId);
  await db
    .update(formDays)
    .set({ nutritionUntracked: untracked, updatedAt: Date.now() })
    .where(eq(formDays.day, day));
}

export async function setDayNote(
  day: DayString,
  note: string | null,
  phaseId: string | null,
): Promise<void> {
  await ensureDay(day, phaseId);
  await db
    .update(formDays)
    .set({ note: note?.trim() || null, updatedAt: Date.now() })
    .where(eq(formDays.day, day));
}

// -------------------------------------------------------------- food rows

export interface LoggedFood {
  foodId: string | null;
  name: string;
  quantity: number;
  unit: FoodUnit;
  energyMcal: number;
  proteinMg: number;
  carbsMg: number | null;
  fatMg: number | null;
  fiberMg: number | null;
  confidence: Confidence;
}

/**
 * Write one thing eaten.
 *
 * The nutrients arrive already computed, from `food.portion`, and are stored as
 * given. Freezing them here is what makes the log a record rather than a live
 * query: correcting a saved food next month must not rewrite what this morning
 * contained.
 */
export async function logFood(
  day: DayString,
  entry: LoggedFood,
  phaseId: string | null,
): Promise<void> {
  await ensureDay(day, phaseId);
  await db.insert(formFoodLogs).values({ id: newFormId('ffl'), day, ...entry });

  // Recency and frequency, so the thing eaten every morning rises to the top
  // of the list tomorrow without anybody organising it.
  if (entry.foodId) {
    const [food] = await db.select().from(formFoods).where(eq(formFoods.id, entry.foodId));
    if (food) {
      await db
        .update(formFoods)
        .set({ lastUsedAt: Date.now(), useCount: food.useCount + 1 })
        .where(eq(formFoods.id, entry.foodId));
    }
  }
}

export async function deleteFoodLog(id: string): Promise<void> {
  await db.delete(formFoodLogs).where(eq(formFoodLogs.id, id));
}

// ------------------------------------------------------------ over a range

export interface DaySummary {
  day: DayString;
  verdict: DayVerdict;
  energyMcal: number | null;
  proteinMg: number | null;
  waterMl: number | null;
  nutritionUntracked: boolean;
  hasFood: boolean;
}

/**
 * Every day in a range, judged.
 *
 * Read in four bulk queries rather than one per day, because the completion
 * graph asks for a whole phase at once and a year of days would otherwise be a
 * year of round trips. The judging itself is the same pure function the Today
 * screen uses, so a square on the graph and the screen it came from can never
 * disagree about what a day was.
 */
export async function getRange(
  from: DayString,
  to: DayString,
  phase: PhaseView | null,
  reference: DayString = today(),
): Promise<DaySummary[]> {
  const days = eachDay(from, to);
  if (days.length === 0) return [];

  const [dayRows, entryRows, foodRows] = await Promise.all([
    db.select().from(formDays).where(and(gte(formDays.day, from), lte(formDays.day, to))),
    db.select().from(formEntries).where(and(gte(formEntries.day, from), lte(formEntries.day, to))),
    db
      .select()
      .from(formFoodLogs)
      .where(and(gte(formFoodLogs.day, from), lte(formFoodLogs.day, to))),
    ]);
  const weightRows = await db
    .select()
    .from(formWeights)
    .where(and(gte(formWeights.day, from), lte(formWeights.day, to)));

  const history = phase ? await targetHistory(phase.id) : [];
  const configured = phase
    ? phase.metrics.map((row) => ({
        metric: row.metric,
        enabled: row.enabled,
        direction: row.direction,
        target: row.target,
      }))
    : [];

  const byDay = <T extends { day: DayString }>(rows: T[]): Map<DayString, T[]> => {
    const map = new Map<DayString, T[]>();
    for (const row of rows) {
      const list = map.get(row.day);
      if (list) list.push(row);
      else map.set(row.day, [row]);
    }
    return map;
  };

  const entriesByDay = byDay(entryRows);
  const foodsByDay = byDay(foodRows);
  const weightByDay = new Map(weightRows.map((row) => [row.day, row]));
  const dayByDay = new Map(dayRows.map((row) => [row.day, row]));

  return days.map((day) => {
    const foods = foodsByDay.get(day) ?? [];
    const nutrition = totals(foods);
    const nutritionUntracked = dayByDay.get(day)?.nutritionUntracked ?? false;
    const entries = entriesByDay.get(day) ?? [];

    const readings = assembleReadings({
      entries,
      weight: weightByDay.get(day),
      nutrition,
      nutritionUntracked,
      foods,
    });

    const rules = rulesFor(configured, history, day);
    const verdict = readDay({ rules, readings, settled: day < reference });

    return {
      day,
      verdict,
      energyMcal: foods.length > 0 && !nutritionUntracked ? nutrition.energyMcal : null,
      proteinMg: foods.length > 0 && !nutritionUntracked ? nutrition.proteinMg : null,
      waterMl: readings.water?.value ?? null,
      nutritionUntracked,
      hasFood: foods.length > 0,
    };
  });
}

/** Weight readings in a range, oldest first, for the trend engine. */
export async function getWeights(from: DayString, to: DayString) {
  const rows = await db
    .select()
    .from(formWeights)
    .where(and(gte(formWeights.day, from), lte(formWeights.day, to)))
    .orderBy(asc(formWeights.day));
  return rows.map((row) => ({ day: row.day, grams: row.grams }));
}

/** Every weight reading there has ever been. */
export async function getAllWeights() {
  const rows = await db.select().from(formWeights).orderBy(asc(formWeights.day));
  return rows.map((row) => ({ day: row.day, grams: row.grams }));
}

/** The most recent reading at or before a day, for seeding a new phase. */
export async function latestWeight(on: DayString = today()): Promise<number | null> {
  const rows = await db
    .select()
    .from(formWeights)
    .where(lte(formWeights.day, on))
    .orderBy(asc(formWeights.day));
  return rows.length > 0 ? rows[rows.length - 1].grams : null;
}

/** Which of a phase's enabled metrics roll up from food rather than an entry. */
export function nutritionMetrics(rules: MetricRule[]): MetricRule[] {
  return rules.filter((rule) => rule.enabled && isNutrition(rule.metric));
}

/** Delete every trace of a day. Used by nothing yet; kept honest for settings. */
export async function clearDay(day: DayString): Promise<void> {
  await db.delete(formFoodLogs).where(eq(formFoodLogs.day, day));
  await db.delete(formEntries).where(eq(formEntries.day, day));
  await db.delete(formWeights).where(eq(formWeights.day, day));
  await db.delete(formDays).where(eq(formDays.day, day));
}

/** Bulk-fetch a handful of days, for the week view. */
export async function getDays(days: DayString[]) {
  if (days.length === 0) return [];
  return db.select().from(formDays).where(inArray(formDays.day, days));
}
