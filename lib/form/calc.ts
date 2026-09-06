import type { PhaseKind, Sex } from './schema';

/**
 * The calculation layer.
 *
 * Everything a screen needs to know that is arithmetic rather than opinion
 * lives here, in one place, so no component ever computes a target inline and
 * no two screens can quietly disagree about what a number means.
 *
 * ## What this layer promises, and what it refuses to promise
 *
 * These are planning figures. A body is not a spreadsheet: the energy content
 * of a kilogram of tissue is a population average, resting metabolism varies
 * by more than the equations admit, and adherence is never what was written
 * down. So the outputs here are deliberately rounded to numbers that look like
 * intentions — a calorie target to the nearest ten, protein to the nearest
 * five grams, water to the nearest hundred millilitres — because a target of
 * 1,927 kcal claims a precision that nothing in the chain supports, and the
 * shape of a number is itself a claim about how much it should be trusted.
 *
 * Nothing here is medical advice, and nothing here should ever be phrased to
 * the reader as though it were.
 */

// ------------------------------------------------------------- constants

/**
 * The energy in a kilogram of body mass. Roughly.
 *
 * The familiar 7,700 kcal figure comes from the energy density of adipose
 * tissue, and real weight change is never purely fat: water shifts dominate
 * the first fortnight, and some lean mass moves in both directions. It is a
 * reasonable planning constant and a terrible prediction, which is why it is
 * used to *set a target* and never to tell anyone what they will weigh.
 */
const KCAL_PER_KG = 7700;

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'high'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** Standard multipliers applied to resting expenditure. */
const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Mostly seated',
  light: 'Lightly active',
  moderate: 'Moderately active',
  high: 'Very active',
};

export const ACTIVITY_NOTE: Record<ActivityLevel, string> = {
  sedentary: 'Desk work, little deliberate movement',
  light: 'Some walking, or one or two sessions a week',
  moderate: 'Training three to five days a week',
  high: 'Training most days, or physical work',
};

/**
 * The line below which Form will not recommend going without supervision.
 *
 * Not a hard stop on what the reader may set for themselves — they are an
 * adult and §64 says the user decides — but a floor on what this app is
 * willing to *suggest*, and the thing that turns an impossible timeline into
 * an honest conversation instead of a very small number.
 */
const ENERGY_FLOOR_KCAL: Record<Sex, number> = {
  male: 1500,
  female: 1200,
  unspecified: 1350,
};

// -------------------------------------------------------------- the body

export interface Body {
  weightG: number;
  heightMm: number | null;
  birthYear: number | null;
  sex: Sex;
  activity: ActivityLevel;
}

/** Age in whole years, or null when the birth year was never given. */
export function ageOf(birthYear: number | null, now = new Date()): number | null {
  if (!birthYear) return null;
  const age = now.getFullYear() - birthYear;
  return age >= 10 && age <= 110 ? age : null;
}

export interface Estimate {
  /** kcal per day. */
  value: number;
  /**
   * How much of the input the estimate actually had.
   *
   * `full` had mass, height and age. `partial` was missing at least one and
   * fell back to an assumption. The interface says which, because an estimate
   * built on a guessed age should not be presented in the same voice as one
   * built on the real thing.
   */
  basis: 'full' | 'partial';
}

/**
 * Resting energy expenditure, by Mifflin-St Jeor.
 *
 * Chosen over Harris-Benedict because it was validated on a more modern
 * population and is the usual clinical default. It takes mass, height, age and
 * sex; where sex is unspecified the two constants are averaged rather than one
 * being picked, which is the honest reading of "I would rather not say".
 *
 * Where height or age are missing the estimate falls back on population
 * assumptions and reports itself as `partial`.
 */
export function restingEnergy(body: Body, now = new Date()): Estimate {
  const kg = body.weightG / 1000;
  const cm = body.heightMm !== null ? body.heightMm / 10 : 170;
  const age = ageOf(body.birthYear, now) ?? 30;
  const basis: Estimate['basis'] =
    body.heightMm !== null && ageOf(body.birthYear, now) !== null ? 'full' : 'partial';

  const constant = body.sex === 'male' ? 5 : body.sex === 'female' ? -161 : -78;
  const value = 10 * kg + 6.25 * cm - 5 * age + constant;

  return { value: Math.max(Math.round(value), 800), basis };
}

/** Resting expenditure scaled by how the days are actually spent. */
export function maintenanceEnergy(body: Body, now = new Date()): Estimate {
  const resting = restingEnergy(body, now);
  return {
    value: Math.round(resting.value * ACTIVITY_FACTOR[body.activity]),
    basis: resting.basis,
  };
}

/** Body mass index. Null without a height, rather than a fabricated one. */
export function bmi(weightG: number, heightMm: number | null): number | null {
  if (!heightMm || heightMm <= 0) return null;
  const metres = heightMm / 1000;
  return Math.round((weightG / 1000 / (metres * metres)) * 10) / 10;
}

/**
 * The usual banding, kept at arm's length.
 *
 * BMI is a population screening tool that knows nothing about build, and it is
 * offered here as one reading among several rather than as a verdict. The app
 * never uses it to gate anything or to editorialise about a body.
 */
export function bmiBand(value: number): 'under' | 'healthy' | 'over' | 'obese' {
  if (value < 18.5) return 'under';
  if (value < 25) return 'healthy';
  if (value < 30) return 'over';
  return 'obese';
}

// ------------------------------------------------------------------ pace

/**
 * How long a change takes at a given proportional rate.
 *
 * Compounding rather than linear, because a fixed *percentage* of bodyweight
 * per week is the rate that stays sustainable as the number falls: 1% of
 * 104 kg is a kilogram, and 1% of 70 kg is seven hundred grams. Treating the
 * rate as a flat kg/week overstates what is achievable at the end of a long
 * cut, which is exactly where people give up.
 */
export function weeksAtRate(startG: number, targetG: number, ratePerWeek: number): number {
  if (ratePerWeek <= 0) return Infinity;
  if (startG === targetG) return 0;

  const losing = targetG < startG;
  const factor = losing ? 1 - ratePerWeek : 1 + ratePerWeek;

  let weight = startG;
  let weeks = 0;
  while (weeks < 520) {
    if (losing ? weight <= targetG : weight >= targetG) break;
    weight *= factor;
    weeks += 1;
  }
  return weeks;
}

/** The average weekly change a timeline implies, in grams. Sign follows direction. */
export function impliedWeeklyChangeG(startG: number, targetG: number, weeks: number): number {
  if (weeks <= 0) return 0;
  return Math.round((targetG - startG) / weeks);
}

/** That change as a proportion of starting mass, which is the number that matters. */
export function impliedRate(startG: number, targetG: number, weeks: number): number {
  if (weeks <= 0 || startG <= 0) return 0;
  return Math.abs(impliedWeeklyChangeG(startG, targetG, weeks)) / startG;
}

// --------------------------------------------------------------- targets

export interface PlanInput {
  body: Body;
  targetWeightG: number;
  weeks: number;
  kind: PhaseKind;
}

export interface Plan {
  /** milli-kcal per day. */
  energy: number;
  /** milligrams per day. */
  protein: number;
  /** millilitres per day. */
  water: number;
  /** steps per day. */
  movement: number;
  /** minutes per night. */
  sleep: number;

  maintenance: number;
  resting: number;
  basis: Estimate['basis'];
  /** kcal/day away from maintenance. Negative on a cut. */
  adjustment: number;
  /** True when the arithmetic wanted to go below the floor and was held there. */
  heldAtFloor: boolean;
}

/**
 * The starting plan for a phase.
 *
 * Every figure is rounded to something that reads as a decision rather than a
 * measurement, per the note at the top of this file.
 */
export function buildPlan(input: PlanInput, now = new Date()): Plan {
  const { body, targetWeightG, weeks, kind } = input;

  const maintenance = maintenanceEnergy(body, now);
  const resting = restingEnergy(body, now);

  const weeklyG = impliedWeeklyChangeG(body.weightG, targetWeightG, weeks);
  const rawAdjustment = ((weeklyG / 1000) * KCAL_PER_KG) / 7;

  /*
    Maintenance means maintenance.

    A phase whose target weight equals its starting weight is not a very slow
    cut, and letting a rounding artefact put it forty calories under would make
    the whole phase quietly wrong.
  */
  const adjustment = kind === 'maintenance' ? 0 : rawAdjustment;

  const floor = ENERGY_FLOOR_KCAL[body.sex];
  const wanted = Math.round((maintenance.value + adjustment) / 10) * 10;
  const energyKcal = Math.max(wanted, floor);

  return {
    energy: energyKcal * 1000,
    protein: proteinTarget(body.weightG, targetWeightG, kind),
    water: waterTarget(body.weightG),
    movement: 8000,
    sleep: 450,
    maintenance: maintenance.value,
    resting: resting.value,
    basis: maintenance.basis,
    adjustment: Math.round(adjustment),
    heldAtFloor: wanted < floor,
  };
}

/**
 * Protein, in milligrams per day.
 *
 * Set against the *lower* of current and goal weight. Protein requirement
 * tracks lean mass rather than total mass, and for somebody carrying a lot of
 * fat the goal weight is much the better proxy: prescribing 2 g/kg of 104 kg
 * would be over two hundred grams a day, which is not a target, it is a
 * second job.
 *
 * The rate itself is higher in a deficit, where protein is doing the work of
 * protecting lean mass, than in a surplus where there is energy to spare.
 */
export function proteinTarget(currentG: number, targetG: number, kind: PhaseKind): number {
  const basisKg = Math.min(currentG, targetG) / 1000;
  const perKg = kind === 'cut' || kind === 'recomp' ? 2.0 : 1.8;
  const grams = Math.round((basisKg * perKg) / 5) * 5;
  return Math.min(Math.max(grams, 60), 240) * 1000;
}

/**
 * Water, in millilitres per day.
 *
 * About 35 ml per kilogram, rounded to the nearest hundred. A starting point
 * rather than a requirement: thirst, climate and training all move it, and the
 * interface says as much rather than presenting it as a quota.
 */
export function waterTarget(weightG: number): number {
  const ml = (weightG / 1000) * 35;
  return Math.min(Math.max(Math.round(ml / 100) * 100, 1500), 5000);
}

// ------------------------------------------------------------- arithmetic

/** Where a value sits between zero and its target, clamped. */
export function progress(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.max(value / target, 0), 1);
}

/** How far through a phase today is, by dates alone. */
export function elapsedFraction(startDay: string, targetDay: string, today: string): number {
  const start = Date.parse(`${startDay}T00:00:00Z`);
  const end = Date.parse(`${targetDay}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(Math.max((now - start) / (end - start), 0), 1);
}

/**
 * How far the body has actually come, as a fraction of the distance intended.
 *
 * Deliberately allowed to exceed 1 and to go negative: a phase that overshot
 * its target, or that moved the wrong way for a fortnight, is a real thing
 * that happened and clamping it would be the app declining to say so.
 */
export function weightProgress(startG: number, currentG: number, targetG: number): number | null {
  const distance = targetG - startG;
  if (distance === 0) return null;
  return (currentG - startG) / distance;
}
