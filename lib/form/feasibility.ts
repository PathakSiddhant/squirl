import { buildPlan, impliedRate, impliedWeeklyChangeG, weeksAtRate, type Body } from './calc';
import type { PhaseKind } from './schema';

/**
 * Is this plan sensible?
 *
 * ## Why this is its own file, and why it is entirely deterministic
 *
 * §7 asks for a reality check on a goal like "104 kg to 70 kg in three
 * months", and it would be very easy to hand that question to a model and
 * print whatever came back. That would be the wrong architecture for a
 * question that is partly about safety.
 *
 * A model asked to judge a rate of weight loss from scratch will usually be
 * approximately right and will occasionally be confidently wrong, and there is
 * no way to tell which from the outside. It also cannot be tested. So the
 * verdict is computed here, from published rate-of-change guidance, in code
 * that a test can pin down and a person can read.
 *
 * The model's job comes strictly afterwards and is strictly narrower: take
 * this verdict and these numbers, and say them in a sentence. It is never
 * asked what the answer is. See `intelligence.ts`.
 *
 * ## The thresholds
 *
 * Stated as a proportion of bodyweight per week rather than as kilograms,
 * because the same kilogram is a very different week for somebody at 104 kg
 * and somebody at 62 kg. The usual guidance for fat loss is roughly 0.5–1% of
 * bodyweight per week, with the upper half of that range harder to hold and
 * increasingly costly in lean mass. Gain is slower: past about half a percent
 * a week, most of what is arriving is not muscle.
 */

export type Verdict = 'comfortable' | 'ambitious' | 'aggressive' | 'unrealistic' | 'none';

/** Loss, as a fraction of bodyweight per week. */
const LOSS_BANDS = { comfortable: 0.0075, ambitious: 0.01, aggressive: 0.015 };
/** Gain. Lower, because tissue is built more slowly than it is lost. */
const GAIN_BANDS = { comfortable: 0.0025, ambitious: 0.005, aggressive: 0.0075 };

export interface Check {
  verdict: Verdict;
  direction: 'loss' | 'gain' | 'hold';
  /** Fraction of bodyweight per week the request implies. */
  rate: number;
  /** Grams per week. Signed. */
  weeklyG: number;
  weeks: number;

  /** A timeline that would land in the `ambitious` band: the fast end of sane. */
  fastestSaneWeeks: number;
  /** A timeline that would land in `comfortable`: the one most people hold. */
  comfortableWeeks: number;

  /**
   * True when the calorie target this timeline implies would fall below the
   * floor Form is willing to recommend. This is the strongest signal of the
   * lot: it means the arithmetic does not work, not merely that it is hard.
   */
  belowEnergyFloor: boolean;
  /** kcal/day the plan implies before any floor is applied. */
  impliedEnergy: number;
}

/**
 * Judge a requested phase.
 *
 * Returns `none` for a maintenance phase or any target that is not actually
 * moving anywhere: there is no rate to be unreasonable about, and warning
 * somebody about the pace of standing still would be noise.
 */
export function check(
  body: Body,
  targetWeightG: number,
  weeks: number,
  kind: PhaseKind,
  now = new Date(),
): Check {
  const weeklyG = impliedWeeklyChangeG(body.weightG, targetWeightG, weeks);
  const rate = impliedRate(body.weightG, targetWeightG, weeks);

  const direction: Check['direction'] =
    targetWeightG < body.weightG ? 'loss' : targetWeightG > body.weightG ? 'gain' : 'hold';

  const bands = direction === 'gain' ? GAIN_BANDS : LOSS_BANDS;

  const plan = buildPlan({ body, targetWeightG, weeks, kind }, now);
  const impliedEnergy = plan.maintenance + plan.adjustment;

  const verdict: Verdict =
    direction === 'hold' || kind === 'maintenance' || weeks <= 0
      ? 'none'
      : plan.heldAtFloor
        ? 'unrealistic'
        : rate <= bands.comfortable
          ? 'comfortable'
          : rate <= bands.ambitious
            ? 'ambitious'
            : rate <= bands.aggressive
              ? 'aggressive'
              : 'unrealistic';

  return {
    verdict,
    direction,
    rate,
    weeklyG,
    weeks,
    fastestSaneWeeks: finite(weeksAtRate(body.weightG, targetWeightG, bands.ambitious)),
    comfortableWeeks: finite(weeksAtRate(body.weightG, targetWeightG, bands.comfortable)),
    belowEnergyFloor: plan.heldAtFloor,
    impliedEnergy: Math.round(impliedEnergy),
  };
}

function finite(weeks: number): number {
  return Number.isFinite(weeks) ? weeks : 0;
}

/**
 * The verdict as a sentence, without a model.
 *
 * Always computed, and used directly whenever the model is unreachable, out of
 * quota, or simply switched off — which per §105 must leave the feature
 * working rather than blank. When the model *is* available it is given this
 * same information and asked to say it more naturally; it is never asked to
 * decide anything this function has already decided.
 *
 * The tone is fixed here on purpose. Nothing in these strings tells anybody
 * they are being unrealistic *as a person*: the plan is the subject of every
 * sentence, never the reader.
 */
export function explain(result: Check): string {
  const perWeek = Math.abs(result.weeklyG) / 1000;
  const kg = perWeek.toFixed(perWeek < 1 ? 2 : 1);
  const pct = (result.rate * 100).toFixed(1);
  const months = (n: number) => `${Math.round((n / 52) * 12)} months`;

  if (result.verdict === 'none') {
    return 'Holding steady. There is no rate of change to plan around here.';
  }

  const moving = result.direction === 'loss' ? 'lose' : 'gain';

  if (result.verdict === 'unrealistic') {
    const reason = result.belowEnergyFloor
      ? 'Hitting it would mean eating less than this app is willing to recommend without supervision.'
      : `That is about ${kg} kg a week, or ${pct}% of bodyweight — faster than a body reliably ${result.direction === 'loss' ? 'loses' : 'builds'} tissue.`;
    return `${reason} Around ${months(result.fastestSaneWeeks)} would be the quickest sensible version of the same goal, and ${months(result.comfortableWeeks)} the one most people actually hold onto.`;
  }

  if (result.verdict === 'aggressive') {
    return `This asks you to ${moving} about ${kg} kg a week, or ${pct}% of bodyweight. That is at the hard end of what is sustainable — workable if the rest of your life is calm, and the first thing to give when it is not. ${months(result.comfortableWeeks)} would be the gentler version.`;
  }

  if (result.verdict === 'ambitious') {
    return `About ${kg} kg a week, or ${pct}% of bodyweight. That is a real pace and a reasonable one, with not much room to drift.`;
  }

  return `About ${kg} kg a week, or ${pct}% of bodyweight. That is a pace you can hold without the rest of your life noticing.`;
}

/** One word for the verdict, for a screen that has already said the rest. */
export const VERDICT_LABEL: Record<Verdict, string> = {
  comfortable: 'Comfortable',
  ambitious: 'Ambitious',
  aggressive: 'Aggressive',
  unrealistic: 'Out of reach',
  none: 'Holding',
};
