'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { isDayString, today, type DayString } from '@/lib/date';
import { portion } from '@/lib/form/food';
import {
  addToEntry,
  clearEntry,
  clearWeight,
  deleteFoodLog,
  logFood,
  logWeight,
  setDayNote,
  setEntry,
  setNutritionUntracked,
} from '@/lib/form/log';
import { findImage } from '@/lib/form/food-image';
import {
  createFood,
  deleteFood,
  duplicateFood,
  getFood,
  referenceOf,
  updateFood,
} from '@/lib/form/foods';
import { getActivePhase } from '@/lib/form/phases';
import {
  parseDuration,
  parseEnergy,
  parseLength,
  parseMacro,
  parseQuantity,
  parseVolume,
  parseWeight,
} from '@/lib/form/units';
import { getProfile } from '@/lib/form/profile';
import { CONFIDENCE, FOOD_UNITS, METRICS, type Metric } from '@/lib/form/schema';

/**
 * Form's boundary with the browser.
 *
 * Everything arriving here is parsed before it reaches the domain. The parsing
 * is deliberately the *same* parser the interface uses to preview a value, so
 * what the reader was shown and what gets stored cannot diverge — a field that
 * previewed `72.5 kg` and saved something else would be worse than no preview
 * at all.
 *
 * Nothing here returns a raw error. A failure comes back as a sentence the
 * reader can act on, and the stack trace goes to the server log where it is
 * useful and nowhere else.
 */

const id = z.string().min(1).max(64);
const metric = z.enum(METRICS);

function day(value: unknown): DayString {
  return isDayString(value) ? value : today();
}

async function activePhaseId(): Promise<string | null> {
  const phase = await getActivePhase();
  return phase?.id ?? null;
}

function done(): { error: null } {
  revalidatePath('/form', 'layout');
  return { error: null };
}

function failed(message: string): { error: string } {
  return { error: message };
}

export type Result = { error: string | null };

// ------------------------------------------------------------------ weight

export async function saveWeight(input: string, on?: string): Promise<Result> {
  const profile = await getProfile();
  const reading = parseWeight(input, profile.weightUnit);
  if (!reading) return failed('That does not look like a weight. Try 72.5, 72.5 kg, or 160 lb.');

  try {
    await logWeight(day(on), reading.value, await activePhaseId());
    return done();
  } catch (error) {
    console.error('[form] save weight failed', error);
    return failed('Could not save that reading. Nothing else was changed.');
  }
}

export async function removeWeight(on?: string): Promise<Result> {
  await clearWeight(day(on));
  return done();
}

// ------------------------------------------------------------------- water

export async function addWater(ml: number, on?: string): Promise<Result> {
  const amount = Math.round(ml);
  if (!Number.isFinite(amount) || amount === 0) return failed('That is not an amount.');
  await addToEntry(day(on), 'water', amount, await activePhaseId());
  return done();
}

export async function setWater(input: string, on?: string): Promise<Result> {
  const profile = await getProfile();
  const reading = parseVolume(input, profile.volumeUnit);
  if (!reading) return failed('Try 2.5L, 2500 ml, or 8 oz.');
  await setEntry(day(on), 'water', reading.value, await activePhaseId());
  return done();
}

// ------------------------------------------------------------- the metrics

/** A metric with two states: taken or not, done or not. */
export async function toggleMetric(name: Metric, on?: string): Promise<Result> {
  const parsed = metric.safeParse(name);
  if (!parsed.success) return failed('Unknown metric.');

  const target = day(on);
  const phaseId = await activePhaseId();

  const { getDayView } = await import('@/lib/form/log');
  const view = await getDayView(target, await getActivePhase());
  const current = view.readings[parsed.data]?.value ?? 0;

  await setEntry(target, parsed.data, current > 0 ? 0 : 1, phaseId);
  return done();
}

/** Steps, sleep, an energy score: one typed value against one metric. */
export async function setMetric(name: Metric, input: string, on?: string): Promise<Result> {
  const parsed = metric.safeParse(name);
  if (!parsed.success) return failed('Unknown metric.');

  const text = input.trim();
  const target = day(on);
  const phaseId = await activePhaseId();

  if (!text) {
    await clearEntry(target, parsed.data);
    return done();
  }

  let value: number | null = null;
  if (parsed.data === 'sleep') value = parseDuration(text);
  else if (parsed.data === 'water') value = parseVolume(text)?.value ?? null;
  else if (parsed.data === 'energy') value = parseEnergy(text);
  else if (parsed.data === 'protein' || parsed.data === 'carbs' || parsed.data === 'fat' || parsed.data === 'fiber') {
    value = parseMacro(text);
  } else {
    const numeric = Number(text.replace(/[, ]/g, ''));
    value = Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : null;
  }

  if (value === null) return failed('That value could not be read.');

  await setEntry(target, parsed.data, value, phaseId);
  return done();
}

/**
 * "I could not track this."
 *
 * The single most important write in the product. It records an absence rather
 * than inventing a number, and it never removes what was already logged.
 */
export async function markUntracked(untracked: boolean, on?: string): Promise<Result> {
  await setNutritionUntracked(day(on), untracked, await activePhaseId());
  return done();
}

export async function saveDayNote(note: string, on?: string): Promise<Result> {
  await setDayNote(day(on), note.slice(0, 2000), await activePhaseId());
  return done();
}

// -------------------------------------------------------------------- food

const foodInput = z.object({
  name: z.string().trim().min(1).max(80),
  brand: z.string().trim().max(60).nullable().optional(),
  refQuantity: z.string().trim().min(1),
  refUnit: z.enum(FOOD_UNITS),
  energy: z.string().trim(),
  protein: z.string().trim(),
  carbs: z.string().trim().optional(),
  fat: z.string().trim().optional(),
  fiber: z.string().trim().optional(),
  confidence: z.enum(CONFIDENCE).optional(),
});

export type FoodFormInput = z.infer<typeof foodInput>;

function readFoodInput(raw: FoodFormInput) {
  const parsed = foodInput.safeParse(raw);
  if (!parsed.success) return null;
  const value = parsed.data;

  const quantity = parseQuantity(value.refQuantity, value.refUnit === 'ml' ? 'ml' : 'g');
  const energy = parseEnergy(value.energy);
  const protein = parseMacro(value.protein);
  if (!quantity || energy === null || protein === null) return null;

  const optional = (text?: string) => {
    if (!text || !text.trim()) return null;
    return parseMacro(text);
  };

  return {
    name: value.name,
    brand: value.brand?.trim() || null,
    refQuantity: quantity.value,
    refUnit: value.refUnit,
    energyMcal: energy,
    proteinMg: protein,
    carbsMg: optional(value.carbs),
    fatMg: optional(value.fat),
    fiberMg: optional(value.fiber),
    confidence: value.confidence ?? ('known' as const),
  };
}

export async function saveFood(raw: FoodFormInput): Promise<Result & { id?: string }> {
  const input = readFoodInput(raw);
  if (!input) return failed('Check the numbers — a quantity, calories and protein are needed.');

  try {
    const created = await createFood(input);
    revalidatePath('/form', 'layout');
    return { error: null, id: created };
  } catch (error) {
    console.error('[form] save food failed', error);
    return failed('Could not save that food.');
  }
}

export async function editFood(foodId: string, raw: FoodFormInput): Promise<Result> {
  const parsedId = id.safeParse(foodId);
  const input = readFoodInput(raw);
  if (!parsedId.success || !input) return failed('Check the numbers before saving.');

  await updateFood(parsedId.data, input);
  return done();
}

export async function removeFood(foodId: string): Promise<Result> {
  const parsed = id.safeParse(foodId);
  if (!parsed.success) return failed('Unknown food.');
  await deleteFood(parsed.data);
  return done();
}

export async function copyFood(foodId: string): Promise<Result> {
  const parsed = id.safeParse(foodId);
  if (!parsed.success) return failed('Unknown food.');
  await duplicateFood(parsed.data);
  return done();
}

/**
 * Go and find a picture of this food.
 *
 * Called on its own rather than inside `saveFood`, because a network round
 * trip has no business sitting between somebody pressing save and the row
 * appearing. The food is written first and the picture arrives afterwards, or
 * it does not arrive and nothing is worse than it was.
 */
export async function fetchFoodImage(foodId: string): Promise<Result & { image?: string }> {
  const parsed = id.safeParse(foodId);
  if (!parsed.success) return failed('Unknown food.');

  const food = await getFood(parsed.data);
  if (!food) return failed('Unknown food.');

  const image = await findImage(food.name);
  if (!image) return failed('Could not find a picture for that one.');

  await updateFood(parsed.data, { image });
  revalidatePath('/form/food');
  revalidatePath('/form');
  return { ...done(), image };
}

/**
 * Find a picture for a name that has not been saved yet.
 *
 * The add dialog needs this before the food exists, so it takes a name rather
 * than an id and stores nothing. What comes back is held in the form until the
 * food is saved, which keeps a lookup somebody then cancels from leaving a row
 * behind.
 */
export async function lookUpImage(name: string): Promise<{ image: string | null; error: string | null }> {
  const clean = name.trim();
  if (clean.length < 2) return { image: null, error: 'Give it a name first.' };

  const image = await findImage(clean);
  return image
    ? { image, error: null }
    : { image: null, error: 'Nothing turned up for that name.' };
}

/**
 * Use this picture instead.
 *
 * Takes an already-encoded `data:` URL, which is what the browser produces
 * from a chosen file. Doing the encoding on the client keeps the raw file off
 * the wire and out of the action's argument limit, and means the same code
 * path stores a found picture and a supplied one.
 */
export async function setFoodImage(foodId: string, image: string | null): Promise<Result> {
  const parsed = id.safeParse(foodId);
  if (!parsed.success) return failed('Unknown food.');

  if (image !== null) {
    if (!image.startsWith('data:image/')) return failed('That is not an image.');
    // Roughly 700 KB of base64. Anything larger is a photograph nobody resized.
    if (image.length > 950_000) return failed('That image is too large.');
  }

  await updateFood(parsed.data, { image });
  revalidatePath('/form/food');
  revalidatePath('/form');
  return done();
}

/**
 * Eat a saved food.
 *
 * The proportion is computed here, once, and stored as a frozen row. That is
 * what makes a food log a record rather than a live join: editing the library
 * entry next month cannot rewrite what this morning contained.
 */
export async function logSavedFood(
  foodId: string,
  quantityInput: string,
  on?: string,
): Promise<Result> {
  const parsed = id.safeParse(foodId);
  if (!parsed.success) return failed('Unknown food.');

  const food = await getFood(parsed.data);
  if (!food) return failed('That food is no longer in your library.');

  const quantity = parseQuantity(quantityInput, food.refUnit === 'ml' ? 'ml' : 'g');
  if (!quantity) return failed('How much? Try 68.5, 68.5 g, or 1 piece.');

  const nutrients = portion(referenceOf(food), quantity.value);

  await logFood(
    day(on),
    {
      foodId: food.id,
      name: food.name,
      quantity: quantity.value,
      unit: food.refUnit,
      ...nutrients,
      confidence: food.confidence,
    },
    await activePhaseId(),
  );

  return done();
}

/**
 * Something eaten once that is not worth keeping.
 *
 * §28: not every food deserves a permanent entry in a personal library, and
 * forcing one is how a library fills up with things eaten a single time on
 * holiday.
 */
export async function logQuickFood(
  raw: { name: string; energy: string; protein: string; confidence?: string },
  on?: string,
): Promise<Result> {
  const name = raw.name.trim().slice(0, 80) || 'Something';
  const energy = parseEnergy(raw.energy);
  const protein = raw.protein.trim() ? parseMacro(raw.protein) : 0;

  if (energy === null || protein === null) return failed('Calories could not be read.');

  const confidence = CONFIDENCE.includes(raw.confidence as never)
    ? (raw.confidence as (typeof CONFIDENCE)[number])
    : 'estimated';

  await logFood(
    day(on),
    {
      foodId: null,
      name,
      quantity: 1_000,
      unit: 'serving',
      energyMcal: energy,
      proteinMg: protein,
      carbsMg: null,
      fatMg: null,
      fiberMg: null,
      confidence,
    },
    await activePhaseId(),
  );

  return done();
}

export async function removeFoodLog(logId: string): Promise<Result> {
  const parsed = id.safeParse(logId);
  if (!parsed.success) return failed('Unknown entry.');
  await deleteFoodLog(parsed.data);
  return done();
}

// ------------------------------------------------------------ measurements

export async function saveMeasurement(site: string, input: string, on?: string): Promise<Result> {
  const clean = site.trim().slice(0, 40);
  if (!clean) return failed('Name the measurement.');

  const value = parseLength(input);
  if (value === null) return failed('Try 84, 84 cm, or 33 in.');

  const { db } = await import('@/lib/db/client');
  const { formMeasurements } = await import('@/lib/form/schema');
  const { newFormId } = await import('@/lib/form/id');

  await db
    .insert(formMeasurements)
    .values({ id: newFormId('fms'), day: day(on), site: clean, valueMm: value })
    .onConflictDoUpdate({
      target: [formMeasurements.day, formMeasurements.site],
      set: { valueMm: value },
    });

  return done();
}

export async function removeMeasurement(measurementId: string): Promise<Result> {
  const parsed = id.safeParse(measurementId);
  if (!parsed.success) return failed('Unknown measurement.');

  const { db } = await import('@/lib/db/client');
  const { formMeasurements } = await import('@/lib/form/schema');
  const { eq } = await import('drizzle-orm');

  await db.delete(formMeasurements).where(eq(formMeasurements.id, parsed.data));
  return done();
}

// ------------------------------------------------------------------- notes

export async function saveNote(body: string, phaseId?: string | null): Promise<Result> {
  const clean = body.trim().slice(0, 4000);
  if (!clean) return failed('Nothing to save.');

  const { db } = await import('@/lib/db/client');
  const { formNotes } = await import('@/lib/form/schema');
  const { newFormId } = await import('@/lib/form/id');

  await db.insert(formNotes).values({
    id: newFormId('fnt'),
    phaseId: phaseId ?? null,
    body: clean,
  });

  return done();
}

export async function editNote(noteId: string, body: string): Promise<Result> {
  const parsed = id.safeParse(noteId);
  const clean = body.trim().slice(0, 4000);
  if (!parsed.success || !clean) return failed('Nothing to save.');

  const { db } = await import('@/lib/db/client');
  const { formNotes } = await import('@/lib/form/schema');
  const { eq } = await import('drizzle-orm');

  await db
    .update(formNotes)
    .set({ body: clean, updatedAt: Date.now() })
    .where(eq(formNotes.id, parsed.data));
  return done();
}

export async function removeNote(noteId: string): Promise<Result> {
  const parsed = id.safeParse(noteId);
  if (!parsed.success) return failed('Unknown note.');

  const { db } = await import('@/lib/db/client');
  const { formNotes } = await import('@/lib/form/schema');
  const { eq } = await import('drizzle-orm');

  await db.delete(formNotes).where(eq(formNotes.id, parsed.data));
  return done();
}

export async function pinNote(noteId: string, pinned: boolean): Promise<Result> {
  const parsed = id.safeParse(noteId);
  if (!parsed.success) return failed('Unknown note.');

  const { db } = await import('@/lib/db/client');
  const { formNotes } = await import('@/lib/form/schema');
  const { eq } = await import('drizzle-orm');

  await db.update(formNotes).set({ pinned }).where(eq(formNotes.id, parsed.data));
  return done();
}

// ------------------------------------------------------------------ phases

const goalInput = z.object({
  kind: z.enum(['cut', 'maintenance', 'lean-bulk', 'recomp', 'custom']),
  currentWeight: z.string().trim(),
  targetWeight: z.string().trim(),
  height: z.string().trim().optional(),
  weeks: z.number().int().min(1).max(260),
  sex: z.enum(['male', 'female', 'unspecified']).optional(),
  birthYear: z.number().int().min(1900).max(2100).nullable().optional(),
  activity: z.enum(['sedentary', 'light', 'moderate', 'high']).optional(),
});

export type GoalInput = z.infer<typeof goalInput>;

export interface GoalAssessment {
  error: null;
  currentWeightG: number;
  targetWeightG: number;
  heightMm: number | null;
  verdict: string;
  verdictLabel: string;
  rate: number;
  weeklyG: number;
  fastestSaneWeeks: number;
  comfortableWeeks: number;
  /** The sentence to show. From the model when it answered, from code when not. */
  explanation: string;
  /** True when the sentence came from code rather than the model. */
  offline: boolean;
  plan: {
    energy: number;
    protein: number;
    water: number;
    movement: number;
    sleep: number;
    maintenance: number;
    basis: 'full' | 'partial';
    heldAtFloor: boolean;
  };
}

/**
 * Judge a goal, and say so.
 *
 * The verdict is computed deterministically first (see `feasibility.ts`), and
 * only then handed to the model to be phrased. If the model is unreachable the
 * deterministic sentence is used and `offline` says so, so the feature works
 * either way, which is the whole of §105.
 */
export async function assessGoal(raw: GoalInput): Promise<GoalAssessment | { error: string }> {
  const parsed = goalInput.safeParse(raw);
  if (!parsed.success) return failed('Check the numbers before continuing.');
  const input = parsed.data;

  const profile = await getProfile();
  const current = parseWeight(input.currentWeight, profile.weightUnit);
  if (!current) return failed('That current weight could not be read. Try 72.5 or 160 lb.');

  const target =
    input.kind === 'maintenance' && !input.targetWeight
      ? current
      : parseWeight(input.targetWeight, profile.weightUnit);
  if (!target) return failed('That target weight could not be read.');

  const { parseHeight } = await import('@/lib/form/units');
  const height = input.height ? parseHeight(input.height, profile.heightUnit) : null;
  const heightMm = height?.value ?? profile.heightMm;

  const { buildPlan } = await import('@/lib/form/calc');
  const { check, explain: deterministic, VERDICT_LABEL } = await import('@/lib/form/feasibility');
  const body = {
    weightG: current.value,
    heightMm,
    birthYear: input.birthYear ?? profile.birthYear,
    sex: input.sex ?? profile.sex,
    activity: input.activity ?? profile.activity,
  };

  const result = check(body, target.value, input.weeks, input.kind);
  const plan = buildPlan({ body, targetWeightG: target.value, weeks: input.weeks, kind: input.kind });

  return {
    error: null,
    currentWeightG: current.value,
    targetWeightG: target.value,
    heightMm,
    verdict: result.verdict,
    verdictLabel: VERDICT_LABEL[result.verdict],
    rate: result.rate,
    weeklyG: result.weeklyG,
    fastestSaneWeeks: result.fastestSaneWeeks,
    comfortableWeeks: result.comfortableWeeks,
    explanation: deterministic(result),
    offline: true,
    plan: {
      energy: plan.energy,
      protein: plan.protein,
      water: plan.water,
      movement: plan.movement,
      sleep: plan.sleep,
      maintenance: plan.maintenance,
      basis: plan.basis,
      heldAtFloor: plan.heldAtFloor,
    },
  };
}

/**
 * The same verdict, said better.
 *
 * Split from `assessGoal` on purpose. The arithmetic is instant and the
 * sentence is a network round trip, and making the reader wait on the second
 * to see the first would mean an empty panel every time a number moved. So the
 * deterministic sentence lands immediately and this quietly replaces it a
 * moment later — or does not, in which case nothing was lost (§105).
 */
export async function phraseGoal(raw: GoalInput): Promise<{ sentence: string | null }> {
  const parsed = goalInput.safeParse(raw);
  if (!parsed.success) return { sentence: null };
  const input = parsed.data;

  const profile = await getProfile();
  const current = parseWeight(input.currentWeight, profile.weightUnit);
  const target =
    input.kind === 'maintenance' && !input.targetWeight
      ? current
      : parseWeight(input.targetWeight, profile.weightUnit);
  if (!current || !target) return { sentence: null };

  const { parseHeight } = await import('@/lib/form/units');
  const height = input.height ? parseHeight(input.height, profile.heightUnit) : null;

  const { check } = await import('@/lib/form/feasibility');
  const { phraseVerdict } = await import('@/lib/form/intelligence');

  const result = check(
    {
      weightG: current.value,
      heightMm: height?.value ?? profile.heightMm,
      birthYear: input.birthYear ?? profile.birthYear,
      sex: input.sex ?? profile.sex,
      activity: input.activity ?? profile.activity,
    },
    target.value,
    input.weeks,
    input.kind,
  );

  const sentence = await phraseVerdict(result, profile.weightUnit).catch(() => null);
  return { sentence };
}

const startInput = goalInput.extend({
  name: z.string().trim().min(1).max(48),
  /** Targets the reader typed instead of accepting. Fine units, already parsed. */
  overrides: z
    .object({
      energy: z.number().int().nullable().optional(),
      protein: z.number().int().nullable().optional(),
      water: z.number().int().nullable().optional(),
      movement: z.number().int().nullable().optional(),
      sleep: z.number().int().nullable().optional(),
    })
    .optional(),
});

export type StartPhaseInput = z.infer<typeof startInput>;

/** Open a phase. Whatever was running is completed first, in one step. */
export async function startPhase(raw: StartPhaseInput): Promise<Result & { id?: string }> {
  const parsed = startInput.safeParse(raw);
  if (!parsed.success) return failed('Something in that setup was incomplete.');
  const input = parsed.data;

  const assessment = await assessGoal(input);
  if (assessment.error !== null) return failed(assessment.error);
  const assessed = assessment as GoalAssessment;

  try {
    const { createPhase, targetDayFor } = await import('@/lib/form/phases');
    const { buildPlan } = await import('@/lib/form/calc');
    const { logWeight } = await import('@/lib/form/log');
    const { updateProfile } = await import('@/lib/form/profile');

    const profile = await getProfile();
    const start = today();

    // The setup screen is the only place these are asked for, so whatever was
    // answered there becomes the profile rather than living on one phase.
    await updateProfile({
      heightMm: assessed.heightMm ?? profile.heightMm,
      sex: input.sex ?? profile.sex,
      birthYear: input.birthYear ?? profile.birthYear,
      activity: input.activity ?? profile.activity,
    });

    const body = {
      weightG: assessed.currentWeightG,
      heightMm: assessed.heightMm,
      birthYear: input.birthYear ?? profile.birthYear,
      sex: input.sex ?? profile.sex,
      activity: input.activity ?? profile.activity,
    };

    const plan = buildPlan({
      body,
      targetWeightG: assessed.targetWeightG,
      weeks: input.weeks,
      kind: input.kind,
    });

    const created = await createPhase({
      name: input.name,
      kind: input.kind,
      startDay: start,
      targetDay: targetDayFor(start, input.weeks),
      startWeightG: assessed.currentWeightG,
      targetWeightG: assessed.targetWeightG,
      plan,
      overrides: input.overrides ?? {},
    });

    // The weight that opened the phase is also the first reading in its log, so
    // the trend has somewhere to start from on day one.
    await logWeight(start, assessed.currentWeightG, created);

    revalidatePath('/form', 'layout');
    revalidatePath('/', 'layout');
    return { error: null, id: created };
  } catch (error) {
    console.error('[form] start phase failed', error);
    return failed('Could not start that phase. Nothing was changed.');
  }
}

export async function finishPhase(phaseId: string): Promise<Result> {
  const parsed = id.safeParse(phaseId);
  if (!parsed.success) return failed('Unknown phase.');

  const { completePhase } = await import('@/lib/form/phases');
  const { latestWeight } = await import('@/lib/form/log');

  await completePhase(parsed.data, await latestWeight());
  revalidatePath('/form', 'layout');
  revalidatePath('/', 'layout');
  return done();
}

/** Push the finishing line back rather than closing and reopening (§100). */
export async function continuePhase(phaseId: string, extraWeeks: number): Promise<Result> {
  const parsed = id.safeParse(phaseId);
  if (!parsed.success) return failed('Unknown phase.');

  const { getPhase, extendPhase } = await import('@/lib/form/phases');
  const { addDays } = await import('@/lib/date');

  const phase = await getPhase(parsed.data);
  if (!phase) return failed('Unknown phase.');

  await extendPhase(parsed.data, addDays(phase.targetDay, Math.max(extraWeeks, 1) * 7));
  return done();
}

export async function editPhase(phaseId: string, name: string, note: string | null): Promise<Result> {
  const parsed = id.safeParse(phaseId);
  if (!parsed.success) return failed('Unknown phase.');

  const { renamePhase } = await import('@/lib/form/phases');
  await renamePhase(parsed.data, name, note);
  return done();
}

// ----------------------------------------------------------------- targets

/**
 * Change a target mid-phase.
 *
 * Writes forward only. Days already lived keep being judged against whatever
 * was in force when they happened, which is what `form_target_history` is for
 * and what §60 and §61 insist on.
 */
export async function changeTarget(phaseId: string, name: Metric, input: string): Promise<Result> {
  const parsedId = id.safeParse(phaseId);
  const parsedMetric = metric.safeParse(name);
  if (!parsedId.success || !parsedMetric.success) return failed('Unknown target.');

  const text = input.trim();
  const { setTarget } = await import('@/lib/form/phases');

  if (!text) {
    await setTarget(parsedId.data, parsedMetric.data, null);
    return done();
  }

  const profile = await getProfile();
  let value: number | null = null;

  switch (parsedMetric.data) {
    case 'energy':
      value = parseEnergy(text);
      break;
    case 'protein':
    case 'carbs':
    case 'fat':
    case 'fiber':
      value = parseMacro(text);
      break;
    case 'water':
      value = parseVolume(text, profile.volumeUnit)?.value ?? null;
      break;
    case 'sleep':
      value = parseDuration(text);
      break;
    case 'weight':
      value = parseWeight(text, profile.weightUnit)?.value ?? null;
      break;
    default: {
      const numeric = Number(text.replace(/[, ]/g, ''));
      value = Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : null;
    }
  }

  if (value === null) return failed('That target could not be read.');

  await setTarget(parsedId.data, parsedMetric.data, value);
  return done();
}

export async function toggleTracking(phaseId: string, name: Metric, enabled: boolean): Promise<Result> {
  const parsedId = id.safeParse(phaseId);
  const parsedMetric = metric.safeParse(name);
  if (!parsedId.success || !parsedMetric.success) return failed('Unknown metric.');

  const { setMetricEnabled } = await import('@/lib/form/phases');
  await setMetricEnabled(parsedId.data, parsedMetric.data, enabled);
  return done();
}

// ---------------------------------------------------------------- settings

export async function saveProfile(patch: {
  weightUnit?: 'kg' | 'lb';
  heightUnit?: 'cm' | 'ft';
  volumeUnit?: 'ml' | 'oz';
  sex?: 'male' | 'female' | 'unspecified';
  activity?: 'sedentary' | 'light' | 'moderate' | 'high';
  birthYear?: number | null;
  height?: string;
  weighCadence?: 'daily' | 'often' | 'weekly' | 'custom';
  trackMeasurements?: boolean;
}): Promise<Result> {
  const { updateProfile } = await import('@/lib/form/profile');
  const { parseHeight } = await import('@/lib/form/units');

  const next: Record<string, unknown> = { ...patch };
  delete next.height;

  if (patch.height !== undefined) {
    const parsedHeight = patch.height.trim() ? parseHeight(patch.height) : null;
    if (patch.height.trim() && !parsedHeight) return failed('That height could not be read.');
    next.heightMm = parsedHeight?.value ?? null;
  }

  await updateProfile(next);
  revalidatePath('/form/progress');
  return done();
}
