/**
 * Reading what a person actually typed.
 *
 * The governing rule is that **input is not storage**. Somebody standing off a
 * scale types `72.5`, or `104 kg`, or `5'4`, or `2.5L`, and every one of those
 * is a complete, unambiguous thought. A form that answers with a number field
 * and a unit dropdown beside it has pushed its own storage problem onto the
 * person using it, twice per field, every single day.
 *
 * So there is one parser per dimension, each of which accepts the whole range
 * of ways that dimension is normally written, and each of which reports which
 * unit it understood. When no unit is written the caller's preferred unit is
 * assumed and the result says so, which lets the interface confirm the reading
 * quietly ("72.5 kg") rather than interrogating.
 *
 * Everything returns a canonical integer. See the note in `schema.ts` on why
 * nothing here is a float.
 */

// --------------------------------------------------------------- decimals

/**
 * Multiply a decimal *written as text* by a power of ten, exactly.
 *
 * `72.5` scaled by 1000 is 72500 and not 72499.99999999999. Going through the
 * string rather than through `parseFloat` keeps the arithmetic in integers,
 * which matters most at the food layer where this value is then multiplied by
 * a proportion and summed across a day.
 *
 * Digits beyond the scale are truncated rather than rounded, on purpose: they
 * are precision the unit cannot hold, and inventing a rounding rule for them
 * would be inventing precision.
 */
export function scaleDecimal(text: string, factor: number): number | null {
  const match = /^(-?)(\d*)(?:[.,](\d*))?$/.exec(text.trim());
  if (!match) return null;

  const [, sign, whole = '', frac = ''] = match;
  if (whole === '' && frac === '') return null;

  const places = Math.round(Math.log10(factor));
  const padded = (frac + '0'.repeat(places)).slice(0, places);

  const value = Number(whole || '0') * factor + Number(padded || '0');
  if (!Number.isFinite(value)) return null;
  return sign === '-' ? -value : value;
}

/** Canonical integer back to a decimal string, without trailing noise. */
export function unscale(value: number, factor: number, places = 1): string {
  const n = value / factor;
  const fixed = n.toFixed(places);

  /*
    Trailing zeros come off the fraction and only the fraction.

    The old version ran `/\.?0+$/` over the whole string, which is fine for
    `2.0` and catastrophic for `170`: with no decimal point to stop it, the
    pattern happily ate the final zero and a height of 170 cm rendered as
    17 cm. Any figure ending in a zero was wrong by a factor of ten.
  */
  if (!fixed.includes('.')) return fixed;
  return fixed.replace(/0+$/, '').replace(/\.$/, '') || '0';
}

/**
 * The number written in a piece of text, and whatever followed it.
 *
 * One normalisation pass handles the things people actually type: a unicode
 * prime instead of an apostrophe, a comma as a decimal separator, a stray
 * non-breaking space pasted from somewhere else.
 */
function normalise(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/ /g, ' ')
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/\s+/g, ' ');
}

export interface Reading<U extends string> {
  /** Canonical integer: grams, millimetres, millilitres, milli-kcal, minutes. */
  value: number;
  /** The unit that was actually understood. */
  unit: U;
  /** True when nothing was written and the caller's preference was assumed. */
  assumed: boolean;
}

// ----------------------------------------------------------------- weight

export type WeightUnit = 'kg' | 'lb';

const POUND_IN_GRAMS = 453.59237;
const STONE_IN_GRAMS = POUND_IN_GRAMS * 14;

/**
 * Body mass, as grams.
 *
 * Accepts `72.5`, `72.5 kg`, `72,5kg`, `160 lb`, `160lbs`, `11 st 4`.
 * Stones are here because the parser costs nothing extra and a reading it
 * cannot understand is worse than one nobody uses.
 */
export function parseWeight(input: string, prefer: WeightUnit = 'kg'): Reading<WeightUnit> | null {
  const text = normalise(input);
  if (!text) return null;

  // Stones and pounds: "11 st 4", "11st4lb".
  const stones = /^(\d+(?:[.,]\d+)?)\s*(?:st|stone|stones)\s*(\d+(?:[.,]\d+)?)?\s*(?:lb|lbs|pound|pounds)?$/.exec(text);
  if (stones) {
    const st = scaleDecimal(stones[1], 1000);
    const lb = stones[2] ? scaleDecimal(stones[2], 1000) : 0;
    if (st === null || lb === null) return null;
    const grams = Math.round((st * STONE_IN_GRAMS + lb * POUND_IN_GRAMS) / 1000);
    return sane(grams) ? { value: grams, unit: 'lb', assumed: false } : null;
  }

  const match = /^(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilo|kilos|kilogram|kilograms|lb|lbs|pound|pounds)?$/.exec(text);
  if (!match) return null;

  const milli = scaleDecimal(match[1], 1000);
  if (milli === null) return null;

  const written = match[2];
  const unit: WeightUnit = written
    ? /^(lb|lbs|pound|pounds)$/.test(written)
      ? 'lb'
      : 'kg'
    : prefer;

  const grams = unit === 'lb' ? Math.round(milli * POUND_IN_GRAMS / 1000) : milli;
  return sane(grams) ? { value: grams, unit, assumed: !written } : null;
}

/** A human body, within reason. Rejects a typed decimal point in the wrong place. */
function sane(grams: number): boolean {
  return grams >= 20_000 && grams <= 400_000;
}

export function formatWeight(grams: number, unit: WeightUnit = 'kg', places = 1): string {
  if (unit === 'lb') return `${(grams / POUND_IN_GRAMS).toFixed(places)} lb`;
  return `${unscale(grams, 1000, places)} kg`;
}

/** Just the figure, for places that draw the unit themselves. */
export function weightFigure(grams: number, unit: WeightUnit = 'kg', places = 1): string {
  if (unit === 'lb') return (grams / POUND_IN_GRAMS).toFixed(places);
  return (grams / 1000).toFixed(places);
}

// ----------------------------------------------------------------- height

export type HeightUnit = 'cm' | 'ft';

const INCH_IN_MM = 25.4;

/**
 * Height, as millimetres.
 *
 * Accepts `165`, `165 cm`, `1.65 m`, `5'4`, `5' 4"`, `5ft4`, `5 ft 4 in`,
 * `64 in`. The feet-and-inches forms are the reason this function exists:
 * they are the only common measurement where one value carries two numbers,
 * and no dropdown can express them.
 */
export function parseHeight(input: string, prefer: HeightUnit = 'cm'): Reading<HeightUnit> | null {
  const text = normalise(input);
  if (!text) return null;

  // Feet and inches, in every ordinary spelling.
  const feet = /^(\d+)\s*(?:'|ft|feet|foot)\s*(\d+(?:[.,]\d+)?)?\s*(?:"|in|inch|inches)?$/.exec(text);
  if (feet) {
    const ft = Number(feet[1]);
    const inches = feet[2] ? scaleDecimal(feet[2], 1000) : 0;
    if (inches === null || !Number.isFinite(ft)) return null;
    const mm = Math.round((ft * 12 * 1000 + inches) * INCH_IN_MM / 1000);
    return saneHeight(mm) ? { value: mm, unit: 'ft', assumed: false } : null;
  }

  const match = /^(\d+(?:[.,]\d+)?)\s*(cm|centimetre|centimeter|centimetres|centimeters|m|metre|meter|metres|meters|mm|in|inch|inches)?$/.exec(text);
  if (!match) return null;

  const milli = scaleDecimal(match[1], 1000);
  if (milli === null) return null;
  const written = match[2];

  let mm: number;
  let unit: HeightUnit;

  if (written === 'mm') {
    mm = Math.round(milli / 1000);
    unit = 'cm';
  } else if (written && /^(m|metre|meter|metres|meters)$/.test(written)) {
    mm = milli; // 1.650 m -> 1650 mm, exactly
    unit = 'cm';
  } else if (written && /^(in|inch|inches)$/.test(written)) {
    mm = Math.round(milli * INCH_IN_MM / 1000);
    unit = 'ft';
  } else if (written) {
    mm = Math.round(milli / 100); // centimetres
    unit = 'cm';
  } else {
    /*
      Nothing written, so read the magnitude.

      A bare `1.65` is metres and a bare `165` is centimetres — nobody is 1.65
      centimetres tall and nobody writes their height as 165 metres. This is
      the one place the parser infers from size rather than from preference,
      because the two readings are three orders of magnitude apart and there is
      no ambiguity to get wrong.
    */
    mm = milli < 3_000 ? milli : Math.round(milli / 100);
    unit = prefer;
  }

  return saneHeight(mm) ? { value: mm, unit, assumed: !written } : null;
}

function saneHeight(mm: number): boolean {
  return mm >= 500 && mm <= 2_500;
}

export function formatHeight(mm: number, unit: HeightUnit = 'cm'): string {
  if (unit === 'ft') {
    const totalInches = mm / INCH_IN_MM;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches - feet * 12);
    // 5'12" is 6'0". Rounding up the inches has to carry.
    return inches === 12 ? `${feet + 1}'0"` : `${feet}'${inches}"`;
  }
  return `${unscale(mm, 10, 0)} cm`;
}

// ----------------------------------------------------------------- volume

export type VolumeUnit = 'ml' | 'oz';

const OUNCE_IN_ML = 29.5735295625;

/** Water, as millilitres. Accepts `2.5l`, `2500`, `2500 ml`, `8 oz`, `1 cup`. */
export function parseVolume(input: string, prefer: VolumeUnit = 'ml'): Reading<VolumeUnit> | null {
  const text = normalise(input);
  if (!text) return null;

  const match = /^(\d+(?:[.,]\d+)?)\s*(ml|millilitre|milliliter|millilitres|milliliters|l|litre|liter|litres|liters|oz|ounce|ounces|floz|cup|cups|glass|glasses)?$/.exec(text);
  if (!match) return null;

  const milli = scaleDecimal(match[1], 1000);
  if (milli === null) return null;
  const written = match[2];

  let ml: number;
  let unit: VolumeUnit;

  if (written && /^(l|litre|liter|litres|liters)$/.test(written)) {
    ml = milli; // 2.500 L -> 2500 ml, exactly
    unit = 'ml';
  } else if (written && /^(oz|ounce|ounces|floz)$/.test(written)) {
    ml = Math.round(milli * OUNCE_IN_ML / 1000);
    unit = 'oz';
  } else if (written && /^(cup|cups|glass|glasses)$/.test(written)) {
    ml = Math.round(milli * 250 / 1000);
    unit = 'ml';
  } else if (written) {
    ml = Math.round(milli / 1000); // millilitres
    unit = 'ml';
  } else {
    // A bare number under about ten is litres; above it, millilitres.
    ml = milli < 10_000 ? milli : Math.round(milli / 1000);
    unit = prefer;
  }

  return ml > 0 && ml <= 20_000 ? { value: ml, unit, assumed: !written } : null;
}

export function formatVolume(ml: number, unit: VolumeUnit = 'ml'): string {
  if (unit === 'oz') return `${(ml / OUNCE_IN_ML).toFixed(0)} oz`;
  return ml >= 1000 ? `${unscale(ml, 1000, 2)} L` : `${ml} ml`;
}

// --------------------------------------------------------------- quantity

export type QuantityUnit = 'g' | 'ml' | 'piece' | 'serving';

/**
 * How much of a food, in milli-units of its own unit.
 *
 * `68.5g` is 68500. A bare number takes the food's own unit, which is the
 * common case: the reference says per 100 g, so `68.5` means grams and asking
 * would be pedantic.
 */
export function parseQuantity(
  input: string,
  prefer: QuantityUnit = 'g',
): Reading<QuantityUnit> | null {
  const text = normalise(input);
  if (!text) return null;

  const match = /^(\d+(?:[.,]\d+)?)\s*(g|gram|grams|gm|kg|ml|millilitre|milliliter|l|litre|liter|pc|pcs|piece|pieces|serving|servings|scoop|scoops)?$/.exec(text);
  if (!match) return null;

  const milli = scaleDecimal(match[1], 1000);
  if (milli === null || milli <= 0) return null;
  const written = match[2];

  if (!written) return { value: milli, unit: prefer, assumed: true };
  if (written === 'kg') return { value: milli * 1000, unit: 'g', assumed: false };
  if (/^(l|litre|liter)$/.test(written)) return { value: milli * 1000, unit: 'ml', assumed: false };
  if (/^(g|gram|grams|gm)$/.test(written)) return { value: milli, unit: 'g', assumed: false };
  if (/^(ml|millilitre|milliliter)$/.test(written)) return { value: milli, unit: 'ml', assumed: false };
  if (/^(pc|pcs|piece|pieces)$/.test(written)) return { value: milli, unit: 'piece', assumed: false };
  return { value: milli, unit: 'serving', assumed: false };
}

export function formatQuantity(milli: number, unit: QuantityUnit): string {
  const figure = unscale(milli, 1000, 1);
  if (unit === 'piece') return `${figure} ${milli === 1000 ? 'piece' : 'pieces'}`;
  if (unit === 'serving') return `${figure} ${milli === 1000 ? 'serving' : 'servings'}`;
  return `${figure} ${unit}`;
}

// ----------------------------------------------------------------- energy

/** Calories, as milli-kcal. Accepts `393`, `393 kcal`, `393 cal`, `1,800`. */
export function parseEnergy(input: string): number | null {
  const text = normalise(input).replace(/,(?=\d{3}\b)/g, '');
  const match = /^(\d+(?:[.,]\d+)?)\s*(kcal|cal|calorie|calories|c)?$/.exec(text);
  if (!match) return null;
  const value = scaleDecimal(match[1], 1000);
  return value !== null && value >= 0 && value <= 30_000_000 ? value : null;
}

export function formatEnergy(mcal: number): string {
  return Math.round(mcal / 1000).toLocaleString('en-IN');
}

/** Grams of a macronutrient, as milligrams. Accepts `25`, `25g`, `25.5 g`. */
export function parseMacro(input: string): number | null {
  const text = normalise(input);
  const match = /^(\d+(?:[.,]\d+)?)\s*(g|gram|grams|gm|mg)?$/.exec(text);
  if (!match) return null;
  const value = scaleDecimal(match[1], 1000);
  if (value === null || value < 0) return null;
  const mg = match[2] === 'mg' ? Math.round(value / 1000) : value;
  return mg <= 5_000_000 ? mg : null;
}

export function formatMacro(mg: number, places = 0): string {
  return (mg / 1000).toFixed(places);
}

// --------------------------------------------------------------- duration

/**
 * Sleep, as minutes.
 *
 * Accepts `7h 12m`, `7:12`, `7.5h`, `7h`, `450m`, `450`. The colon form is
 * included because a phone keypad makes it the fastest thing to type.
 */
export function parseDuration(input: string): number | null {
  const text = normalise(input);
  if (!text) return null;

  const clock = /^(\d{1,2}):(\d{1,2})$/.exec(text);
  if (clock) {
    const minutes = Number(clock[1]) * 60 + Number(clock[2]);
    return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
  }

  const both = /^(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours)\s*(\d+)?\s*(?:m|min|mins|minute|minutes)?$/.exec(text);
  if (both) {
    const hourMilli = scaleDecimal(both[1], 1000);
    if (hourMilli === null) return null;
    const minutes = Math.round((hourMilli * 60) / 1000) + Number(both[2] ?? 0);
    return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
  }

  const mins = /^(\d+)\s*(?:m|min|mins|minute|minutes)$/.exec(text);
  if (mins) {
    const minutes = Number(mins[1]);
    return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
  }

  // A bare number: under 24 is hours, otherwise minutes. Nobody sleeps 7 minutes
  // and nobody reports 450 hours.
  const bare = /^(\d+(?:[.,]\d+)?)$/.exec(text);
  if (bare) {
    const milli = scaleDecimal(bare[1], 1000);
    if (milli === null) return null;
    const minutes = milli <= 24_000 ? Math.round((milli * 60) / 1000) : Math.round(milli / 1000);
    return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
  }

  return null;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ------------------------------------------------------------ measurements

/** A tape reading, as millimetres. Accepts `84`, `84 cm`, `33 in`, `840mm`. */
export function parseLength(input: string, prefer: 'cm' | 'in' = 'cm'): number | null {
  const text = normalise(input);
  const match = /^(\d+(?:[.,]\d+)?)\s*(cm|mm|in|inch|inches)?$/.exec(text);
  if (!match) return null;

  const milli = scaleDecimal(match[1], 1000);
  if (milli === null || milli <= 0) return null;
  const written = match[2] ?? prefer;

  const mm =
    written === 'mm'
      ? Math.round(milli / 1000)
      : written === 'cm'
        ? Math.round(milli / 100)
        : Math.round((milli * INCH_IN_MM) / 1000);

  return mm > 0 && mm <= 3_000 ? mm : null;
}

export function formatLength(mm: number, unit: 'cm' | 'in' = 'cm'): string {
  if (unit === 'in') return `${(mm / INCH_IN_MM).toFixed(1)}"`;
  return `${unscale(mm, 10, 1)} cm`;
}
