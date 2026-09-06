import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Form's tables. Every one prefixed `form_`, because Squirl holds one database
 * file and a table belongs to exactly one application.
 *
 * ## The shape follows from one product rule
 *
 * A body is measured over a stretch of time with a stated intention, and then
 * that stretch ends and another begins. So the phase is the spine: exactly one
 * is active, everything logged belongs to a day inside it, and a completed one
 * is a historical record that later settings changes must never rewrite. Open
 * this two years from now and it should still say what the goal was, what the
 * plan was, and what actually happened.
 *
 * ## Integers, everywhere, in fine units
 *
 * Ledger stores paise rather than rupees because `0.1 + 0.2 !== 0.3` and a
 * ledger that drifts is a ledger nobody trusts. The same argument holds here
 * and is arguably sharper, because Form multiplies: 68.5 g of a food defined
 * per 100 g is a proportion applied to every nutrient on the row, and a
 * rounding error introduced there is then summed across a day and averaged
 * across a week.
 *
 * So nothing is stored as a decimal. The canonical units are:
 *
 *   body mass          grams              71.8 kg  ->  71800
 *   length             millimetres        165 cm   ->  1650
 *   volume             millilitres        2.7 L    ->  2700
 *   energy             milli-kcal         1800 cal ->  1800000
 *   macronutrients     milligrams         130 g    ->  130000
 *   food quantity      milli-units        68.5 g   ->  68500
 *   sleep              minutes            7h 12m   ->  432
 *   steps, scores      themselves         8000     ->  8000
 *
 * Milli-kcal looks excessive until you multiply: a food at 393 kcal per 100 g
 * logged at 68.5 g is 269.205 kcal, which is exact in milli-kcal and is not
 * exact in anything coarser. Display rounds; storage does not.
 */

const now = () => Date.now();

// ----------------------------------------------------------------- profile

export const SEXES = ['male', 'female', 'unspecified'] as const;
export type Sex = (typeof SEXES)[number];

export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export const HEIGHT_UNITS = ['cm', 'ft'] as const;
export const VOLUME_UNITS = ['ml', 'oz'] as const;

/** How the days are actually spent. The largest input to a calorie figure after mass. */
export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'high'] as const;

/**
 * How often a weight reading is expected.
 *
 * Expected, not demanded. This exists so the app knows when to *offer* a
 * weigh-in, never so it can report one as missed: weight is a measurement
 * whose daily value is mostly water, and a product that scolds you for
 * skipping a day teaches you to weigh yourself for the app instead of for you.
 */
export const WEIGH_CADENCES = ['daily', 'often', 'weekly', 'custom'] as const;
export type WeighCadence = (typeof WEIGH_CADENCES)[number];

/**
 * The person. Exactly one row, keyed `me`.
 *
 * A single-row table rather than a key-value settings blob, because every
 * column here is read by the calculation layer and a typo in a JSON key should
 * be a type error rather than a silent `undefined` flowing into a formula.
 *
 * `sex` and `birthYear` are here for one reason: the standard resting-energy
 * equations take them, and without them the calorie recommendation is a
 * noticeably worse guess. Both are optional, both can be `unspecified`, and
 * the calculation layer degrades to a mass-only estimate and says so rather
 * than pretending the number is as good. There is no other questionnaire.
 */
export const formProfile = sqliteTable('form_profile', {
  id: text('id').primaryKey(),
  heightMm: integer('height_mm'),
  birthYear: integer('birth_year'),
  sex: text('sex', { enum: SEXES }).notNull().default('unspecified'),
  /**
   * How the days are actually spent, which is the largest single input to a
   * calorie recommendation after mass. One question, four answers, asked once.
   */
  activity: text('activity', { enum: ACTIVITY_LEVELS }).notNull().default('light'),

  // How the reader likes to read values back. Input is parsed from whatever
  // they actually typed; this only decides how it is rendered.
  weightUnit: text('weight_unit', { enum: WEIGHT_UNITS }).notNull().default('kg'),
  heightUnit: text('height_unit', { enum: HEIGHT_UNITS }).notNull().default('cm'),
  volumeUnit: text('volume_unit', { enum: VOLUME_UNITS }).notNull().default('ml'),

  weighCadence: text('weigh_cadence', { enum: WEIGH_CADENCES }).notNull().default('daily'),
  /** For `custom`: days between expected readings. */
  weighEveryDays: integer('weigh_every_days').notNull().default(1),

  /**
   * Whether the tape measure is part of this person's practice at all.
   *
   * Off by default and treated exactly the way §11 treats a metric that is
   * switched off: the tape does not become a row of empty boxes on Progress,
   * it leaves the application. Most people never measure a thigh, and a panel
   * of five blanks is a standing suggestion that they should be.
   */
  trackMeasurements: integer('track_measurements', { mode: 'boolean' }).notNull().default(false),

  createdAt: integer('created_at').notNull().$defaultFn(now),
  updatedAt: integer('updated_at').notNull().$defaultFn(now),
});

// ------------------------------------------------------------------ phases

/**
 * What a stretch of time is for.
 *
 * `custom` is a first-class member rather than an escape hatch. The behaviour
 * of a phase comes from its configured targets, not from its label, so naming
 * one "Summer" and setting the targets by hand works exactly as well as
 * picking `cut` — which is the point of §51 and the reason nothing in the
 * calculation layer branches on this column.
 */
export const PHASE_KINDS = ['cut', 'maintenance', 'lean-bulk', 'recomp', 'custom'] as const;
export type PhaseKind = (typeof PHASE_KINDS)[number];

export const PHASE_STATUSES = ['planned', 'active', 'completed'] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number];

export const formPhases = sqliteTable(
  'form_phases',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind', { enum: PHASE_KINDS }).notNull(),
    status: text('status', { enum: PHASE_STATUSES }).notNull().default('active'),

    /** Day strings, IST, matching the rest of Squirl. A phase spans days. */
    startDay: text('start_day').notNull(),
    targetDay: text('target_day').notNull(),
    /** When it was actually closed, which is rarely the day it was aimed at. */
    endedDay: text('ended_day'),

    startWeightG: integer('start_weight_g'),
    targetWeightG: integer('target_weight_g'),
    /**
     * Frozen at completion.
     *
     * Derivable from the weight log at close, and stored anyway: this is the
     * number the phase is remembered by, and re-deriving it years later means
     * re-deciding what "final" meant every time the trend maths is touched.
     */
    finalWeightG: integer('final_weight_g'),

    note: text('note'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
    updatedAt: integer('updated_at').notNull().$defaultFn(now),
  },
  (t) => [
    /*
      One active phase, enforced here rather than hoped for in the query layer.

      "Exactly one active goal" is the product's most structural rule, and a
      rule that only lives in application code is a rule that a future action
      forgets. A partial unique index makes a second active phase impossible to
      write, while leaving any number of completed and planned ones.
    */
    uniqueIndex('form_phases_one_active_idx')
      .on(t.status)
      .where(sql`${t.status} = 'active'`),
    index('form_phases_status_idx').on(t.status, t.startDay),
  ],
);

// ------------------------------------------------------------------ metrics

/**
 * Everything Form can track. The list is closed; which of them are *on* is not.
 *
 * A closed list because each one has real meaning in the calculation layer —
 * a unit, a direction, a way of deciding whether a day met it — and a metric
 * invented at runtime would have none of that. Which ones apply is per phase,
 * because a cut and a lean bulk are not interested in the same things.
 */
export const METRICS = [
  'weight',
  'energy',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'water',
  'creatine',
  'movement',
  'sleep',
  'mood',
] as const;
export type Metric = (typeof METRICS)[number];

/**
 * Whether a target is a floor or a ceiling.
 *
 * Protein at 130 g means *at least*. Calories at 1,800 on a cut means *at
 * most*. Both are "did I hit it", and getting the direction wrong would mark
 * a disciplined day as a miss, so the direction is data rather than a
 * hard-coded assumption about which metric is which.
 */
export const TARGET_DIRECTIONS = ['at-least', 'at-most', 'around'] as const;
export type TargetDirection = (typeof TARGET_DIRECTIONS)[number];

/**
 * One metric's configuration inside one phase.
 *
 * `target` and `recommended` sit side by side deliberately. Form works out
 * what it would suggest; the reader may take it or set their own; and both
 * numbers are kept so the screen can go on saying "you chose 1,750, Form
 * suggested 1,900" instead of quietly losing the distinction. Nothing ever
 * writes `recommended` over `target`.
 */
export const formPhaseMetrics = sqliteTable(
  'form_phase_metrics',
  {
    id: text('id').primaryKey(),
    phaseId: text('phase_id')
      .notNull()
      .references(() => formPhases.id, { onDelete: 'cascade' }),
    metric: text('metric', { enum: METRICS }).notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

    /** Canonical fine units for that metric. Null for a metric with no target. */
    target: integer('target'),
    /** What Form worked out. Kept even when overridden. */
    recommended: integer('recommended'),
    direction: text('direction', { enum: TARGET_DIRECTIONS }).notNull().default('at-least'),

    createdAt: integer('created_at').notNull().$defaultFn(now),
    updatedAt: integer('updated_at').notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex('form_phase_metrics_pair_idx').on(t.phaseId, t.metric),
    index('form_phase_metrics_phase_idx').on(t.phaseId),
  ],
);

/**
 * Every target this phase has ever had, and the day each one started applying.
 *
 * The reason this table exists is §61. Monday was lived against a 1,800 kcal
 * target; on Thursday the target moves to 1,900; Monday must not retroactively
 * become a day that missed by less. Completion for a given day is judged
 * against the row whose `effectiveFrom` is the latest one on or before it, so
 * history keeps the meaning it had when it happened.
 *
 * Append-only. Nothing here is ever updated or deleted while its phase lives.
 */
export const formTargetHistory = sqliteTable(
  'form_target_history',
  {
    id: text('id').primaryKey(),
    phaseId: text('phase_id')
      .notNull()
      .references(() => formPhases.id, { onDelete: 'cascade' }),
    metric: text('metric', { enum: METRICS }).notNull(),
    target: integer('target'),
    direction: text('direction', { enum: TARGET_DIRECTIONS }).notNull().default('at-least'),
    /** The first day this target applied to. */
    effectiveFrom: text('effective_from').notNull(),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [
    index('form_target_history_lookup_idx').on(t.phaseId, t.metric, t.effectiveFrom),
    uniqueIndex('form_target_history_day_idx').on(t.phaseId, t.metric, t.effectiveFrom),
  ],
);

// -------------------------------------------------------------------- days

/**
 * A day, and what is known about it as a whole.
 *
 * The row exists to hold what belongs to the day rather than to any one
 * metric: which phase it fell in, an optional line about it, and the single
 * most important flag in the product — that the reader ate out, lost track,
 * and is telling the truth about it.
 *
 * `nutritionUntracked` is not zero calories and it is not an estimate. It is
 * an absence, recorded on purpose, and every average and every completion
 * judgement has to skip the day rather than score it. A product that turns
 * "I don't know" into a number is a product that teaches you to guess.
 */
export const formDays = sqliteTable(
  'form_days',
  {
    day: text('day').primaryKey(),
    phaseId: text('phase_id').references(() => formPhases.id, { onDelete: 'set null' }),
    note: text('note'),
    nutritionUntracked: integer('nutrition_untracked', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at').notNull().$defaultFn(now),
    updatedAt: integer('updated_at').notNull().$defaultFn(now),
  },
  (t) => [index('form_days_phase_idx').on(t.phaseId, t.day)],
);

/**
 * One directly-logged metric on one day.
 *
 * Narrow rather than a wide row of nullable columns, because the set of live
 * metrics is configuration rather than schema: enabling `sleep` on the next
 * phase must not require a migration, and a metric switched off must leave no
 * empty column behind to render as an em dash.
 *
 * Nutrition is deliberately absent here. Calories and macros are *sums of food
 * rows*, never a figure typed directly, so that a day's total and the things
 * it is made of can never disagree.
 */
export const formEntries = sqliteTable(
  'form_entries',
  {
    id: text('id').primaryKey(),
    day: text('day').notNull(),
    metric: text('metric', { enum: METRICS }).notNull(),
    /** Canonical fine units. Null when the row exists only to say `untracked`. */
    value: integer('value'),
    /** Known to be unknown, for this metric, on this day. */
    untracked: integer('untracked', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull().$defaultFn(now),
    updatedAt: integer('updated_at').notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex('form_entries_pair_idx').on(t.day, t.metric),
    index('form_entries_metric_idx').on(t.metric, t.day),
  ],
);

/**
 * Weight readings, kept apart from the daily metrics.
 *
 * Weight is a measurement of the body, not a thing you did with your day, and
 * the difference is not pedantic: a missed weigh-in is nothing at all, whereas
 * a missed water target is a fact about the day. Keeping them in separate
 * tables is what stops the completion logic from ever being tempted to score
 * one as the other.
 *
 * One reading per day. Weighing twice before breakfast is correcting the first
 * reading, not recording a second event.
 */
export const formWeights = sqliteTable(
  'form_weights',
  {
    id: text('id').primaryKey(),
    day: text('day').notNull(),
    grams: integer('grams').notNull(),
    note: text('note'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex('form_weights_day_idx').on(t.day),
    check('form_weights_sane', sql`${t.grams} > 0 AND ${t.grams} < 1000000`),
  ],
);

// ------------------------------------------------------------------- food

export const FOOD_UNITS = ['g', 'ml', 'piece', 'serving'] as const;
export type FoodUnit = (typeof FOOD_UNITS)[number];

/**
 * How well the numbers on a row are actually known.
 *
 * Three states rather than a boolean, because "I read it off the packet",
 * "I looked at it and guessed" and "I genuinely have no idea" are three
 * different things and flattening them is how a food log becomes fiction.
 * Nothing in the app upgrades an estimate to a fact.
 */
export const CONFIDENCE = ['known', 'estimated', 'unknown'] as const;
export type Confidence = (typeof CONFIDENCE)[number];

/**
 * The personal food library.
 *
 * Personal, and only personal. There is no public database here to search, no
 * barcode index, no crowd-sourced entries of varying honesty: this is the
 * twenty or thirty things actually eaten week after week, entered once with
 * the packet in hand, and then reused for years.
 *
 * Everything is stored *per reference quantity* — per 100 g, per piece, per
 * serving — and the proportion is applied at log time.
 */
export const formFoods = sqliteTable(
  'form_foods',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    brand: text('brand'),

    /** The quantity the numbers below describe, in milli-units of `refUnit`. */
    refQuantity: integer('ref_quantity').notNull(),
    refUnit: text('ref_unit', { enum: FOOD_UNITS }).notNull().default('g'),

    energyMcal: integer('energy_mcal').notNull().default(0),
    proteinMg: integer('protein_mg').notNull().default(0),
    carbsMg: integer('carbs_mg'),
    fatMg: integer('fat_mg'),
    fiberMg: integer('fiber_mg'),

    confidence: text('confidence', { enum: CONFIDENCE }).notNull().default('known'),

    /**
     * A picture of it.
     *
     * Stored inline as a `data:` URL rather than as a link or a file path, and
     * that is deliberate on all three counts. A remote link makes the library
     * go blank on a train, which breaks the one promise this application makes
     * loudest. A file path puts half of a food in the database and half of it
     * on disk, so copying `squirl.db` no longer copies everything. Inline
     * bytes keep a food a single row: it survives a backup, a restore, and a
     * move to another machine, with no second thing to remember.
     *
     * Images are re-encoded down to a small square before they land here, so a
     * library of a hundred foods costs a couple of megabytes rather than a
     * hundred.
     */
    image: text('image'),

    /** Recency and frequency, so the things eaten every morning surface first. */
    lastUsedAt: integer('last_used_at'),
    useCount: integer('use_count').notNull().default(0),

    archivedAt: integer('archived_at'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
    updatedAt: integer('updated_at').notNull().$defaultFn(now),
  },
  (t) => [
    index('form_foods_name_idx').on(t.name),
    index('form_foods_recent_idx').on(t.lastUsedAt),
    check('form_foods_ref_positive', sql`${t.refQuantity} > 0`),
  ],
);

/**
 * One thing eaten on one day.
 *
 * The nutrients are computed when the row is written and then frozen, and the
 * name is copied rather than joined. Both are deliberate. Editing a saved food
 * because the recipe changed must not silently rewrite what last March's
 * breakfasts contained, and deleting a food from the library must not blank
 * out a year of days that referred to it. `foodId` survives as a link where it
 * still resolves, and the row stands on its own where it does not.
 */
export const formFoodLogs = sqliteTable(
  'form_food_logs',
  {
    id: text('id').primaryKey(),
    day: text('day').notNull(),
    foodId: text('food_id').references(() => formFoods.id, { onDelete: 'set null' }),

    name: text('name').notNull(),
    quantity: integer('quantity').notNull(),
    unit: text('unit', { enum: FOOD_UNITS }).notNull().default('g'),

    energyMcal: integer('energy_mcal').notNull().default(0),
    proteinMg: integer('protein_mg').notNull().default(0),
    carbsMg: integer('carbs_mg'),
    fatMg: integer('fat_mg'),
    fiberMg: integer('fiber_mg'),

    confidence: text('confidence', { enum: CONFIDENCE }).notNull().default('known'),
    loggedAt: integer('logged_at').notNull().$defaultFn(now),
  },
  (t) => [
    index('form_food_logs_day_idx').on(t.day),
    index('form_food_logs_food_idx').on(t.foodId),
  ],
);

// ----------------------------------------------------------- the body itself

/**
 * A tape measure reading. Sites are free text on purpose.
 *
 * Waist, chest, arm and thigh are what the interface offers, but somebody
 * tracking a calf or a single wrist should not be told their body is not one
 * of the supported shapes. Stored in millimetres.
 */
export const formMeasurements = sqliteTable(
  'form_measurements',
  {
    id: text('id').primaryKey(),
    day: text('day').notNull(),
    site: text('site').notNull(),
    valueMm: integer('value_mm').notNull(),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex('form_measurements_pair_idx').on(t.day, t.site),
    index('form_measurements_site_idx').on(t.site, t.day),
  ],
);

export const PHOTO_POSES = ['front', 'side', 'back', 'other'] as const;
export type PhotoPose = (typeof PHOTO_POSES)[number];

/**
 * A progress photo, stored as a file on this machine and a path in this row.
 *
 * The bytes stay on disk rather than going into the database as a blob: they
 * are the largest thing Form holds by an order of magnitude, and a SQLite file
 * that has to be rewritten because a photo was added is a backup story nobody
 * wants. `data/form-photos/` sits beside `data/squirl.db`, so copying the data
 * directory is still copying everything.
 */
export const formPhotos = sqliteTable(
  'form_photos',
  {
    id: text('id').primaryKey(),
    day: text('day').notNull(),
    pose: text('pose', { enum: PHOTO_POSES }).notNull().default('front'),
    /** Relative to the photo directory. Never an absolute path, never a URL. */
    file: text('file').notNull(),
    width: integer('width'),
    height: integer('height'),
    note: text('note'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('form_photos_day_idx').on(t.day, t.pose)],
);

/**
 * What was learned. Not a journal.
 *
 * Notes belong to Form rather than to a phase, because the useful ones outlive
 * the stretch of time that produced them: "cutting hard wrecked my sleep" is
 * worth reading at the start of the next cut, two phases later. A note *may*
 * name the phase it came from, and most will, but nothing requires it and
 * nothing prompts for one daily.
 */
export const formNotes = sqliteTable(
  'form_notes',
  {
    id: text('id').primaryKey(),
    phaseId: text('phase_id').references(() => formPhases.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull().$defaultFn(now),
    updatedAt: integer('updated_at').notNull().$defaultFn(now),
  },
  (t) => [index('form_notes_recent_idx').on(t.createdAt)],
);

// ------------------------------------------------------------------- types

export type FormProfile = typeof formProfile.$inferSelect;
export type FormPhase = typeof formPhases.$inferSelect;
export type FormPhaseMetric = typeof formPhaseMetrics.$inferSelect;
export type FormTargetHistory = typeof formTargetHistory.$inferSelect;
export type FormDay = typeof formDays.$inferSelect;
export type FormEntry = typeof formEntries.$inferSelect;
export type FormWeight = typeof formWeights.$inferSelect;
export type FormFood = typeof formFoods.$inferSelect;
export type FormFoodLog = typeof formFoodLogs.$inferSelect;
export type FormMeasurement = typeof formMeasurements.$inferSelect;
export type FormPhoto = typeof formPhotos.$inferSelect;
export type FormNote = typeof formNotes.$inferSelect;
