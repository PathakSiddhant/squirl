import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { addDays, daysBetween, today, type DayString } from '@/lib/date';

import type { Plan } from './calc';
import { newFormId } from './id';
import {
  formPhaseMetrics,
  formPhases,
  formTargetHistory,
  METRICS,
  type FormPhase,
  type FormPhaseMetric,
  type Metric,
  type PhaseKind,
  type TargetDirection,
} from './schema';

/**
 * The phase: one stretch of time with one intention.
 *
 * Exactly one is active, which the database enforces with a partial unique
 * index rather than leaving to whoever writes the next action. Everything
 * logged hangs off the day it happened on; the phase is what gives those days
 * a target to be measured against and a reason to have been lived that way.
 *
 * A completed phase is a historical record. Nothing in this file mutates one,
 * and nothing outside it should either: §101 is the reason the app is worth
 * keeping for years rather than months.
 */

export interface PhaseView extends FormPhase {
  metrics: FormPhaseMetric[];
  /** 1 on the first day. Reads as "day 41", which is how people talk about it. */
  dayNumber: number;
  totalDays: number;
}

/**
 * Which metrics a new phase starts with, and which way each target points.
 *
 * The defaults are the ones from §11 — the macros beyond protein start off,
 * because tracking carbohydrate and fat is a real cost and most people never
 * need it. Everything here is changed in a tap afterwards; this is only what
 * the app opens with rather than what it insists on.
 *
 * Direction is data rather than an assumption baked into the judging code: a
 * calorie target is a ceiling on a cut and a floor on a bulk, and getting that
 * backwards would mark a disciplined day as a miss.
 */
function defaultMetrics(kind: PhaseKind): Array<{
  metric: Metric;
  enabled: boolean;
  direction: TargetDirection;
}> {
  const energyDirection: TargetDirection =
    kind === 'cut' ? 'at-most' : kind === 'lean-bulk' ? 'at-least' : 'around';

  return [
    { metric: 'weight', enabled: true, direction: 'around' },
    { metric: 'energy', enabled: true, direction: energyDirection },
    { metric: 'protein', enabled: true, direction: 'at-least' },
    { metric: 'carbs', enabled: false, direction: 'at-most' },
    { metric: 'fat', enabled: false, direction: 'at-most' },
    { metric: 'fiber', enabled: false, direction: 'at-least' },
    { metric: 'water', enabled: true, direction: 'at-least' },
    { metric: 'creatine', enabled: true, direction: 'at-least' },
    { metric: 'movement', enabled: true, direction: 'at-least' },
    { metric: 'sleep', enabled: true, direction: 'at-least' },
    { metric: 'mood', enabled: false, direction: 'at-least' },
  ];
}

/** The target a metric takes from a computed plan, in that metric's fine units. */
function planTarget(metric: Metric, plan: Plan, targetWeightG: number | null): number | null {
  switch (metric) {
    case 'weight':
      return targetWeightG;
    case 'energy':
      return plan.energy;
    case 'protein':
      return plan.protein;
    case 'water':
      return plan.water;
    case 'movement':
      return plan.movement;
    case 'sleep':
      return plan.sleep;
    case 'creatine':
      return 1;
    default:
      // Carbohydrate, fat, fibre and mood have no recommended figure. They are
      // off by default, and a reader who turns one on sets what it means to
      // them — Form has no business inventing a fibre target nobody asked for.
      return null;
  }
}

export interface NewPhase {
  name: string;
  kind: PhaseKind;
  startDay: DayString;
  targetDay: DayString;
  startWeightG: number | null;
  targetWeightG: number | null;
  plan: Plan;
  /** Targets the reader set instead of the recommended ones. */
  overrides?: Partial<Record<Metric, number | null>>;
  note?: string | null;
}

/**
 * Open a phase, and close whatever was open.
 *
 * Completing the previous phase is part of starting the next one rather than a
 * separate step the reader has to remember, because the database will refuse a
 * second active row anyway and failing at that point would be the app enforcing
 * its own invariant by showing an error.
 */
export async function createPhase(input: NewPhase): Promise<string> {
  const existing = await getActivePhaseRow();
  if (existing) await completePhase(existing.id, null);

  const id = newFormId('fph');
  const stamp = Date.now();

  await db.insert(formPhases).values({
    id,
    name: input.name.trim() || 'Phase',
    kind: input.kind,
    status: 'active',
    startDay: input.startDay,
    targetDay: input.targetDay,
    startWeightG: input.startWeightG,
    targetWeightG: input.targetWeightG,
    note: input.note ?? null,
  });

  const rows = defaultMetrics(input.kind).map((row) => {
    const recommended = planTarget(row.metric, input.plan, input.targetWeightG);
    const override = input.overrides?.[row.metric];
    return {
      id: newFormId('fpm'),
      phaseId: id,
      metric: row.metric,
      enabled: row.enabled,
      direction: row.direction,
      recommended,
      // The reader's number wins wherever they gave one. Nothing later
      // overwrites it with a recommendation (§10, §64).
      target: override !== undefined ? override : recommended,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });

  await db.insert(formPhaseMetrics).values(rows);

  // Seed the history at the phase's first day, so every day it contains has a
  // target to be judged against without falling back to current configuration.
  await db.insert(formTargetHistory).values(
    rows.map((row) => ({
      id: newFormId('fth'),
      phaseId: id,
      metric: row.metric,
      target: row.target,
      direction: row.direction,
      effectiveFrom: input.startDay,
      createdAt: stamp,
    })),
  );

  return id;
}

async function getActivePhaseRow(): Promise<FormPhase | undefined> {
  const [row] = await db.select().from(formPhases).where(eq(formPhases.status, 'active'));
  return row;
}

export async function getActivePhase(reference: DayString = today()): Promise<PhaseView | null> {
  const row = await getActivePhaseRow();
  return row ? decorate(row, reference) : null;
}

export async function getPhase(id: string, reference: DayString = today()): Promise<PhaseView | null> {
  const [row] = await db.select().from(formPhases).where(eq(formPhases.id, id));
  return row ? decorate(row, reference) : null;
}

async function decorate(row: FormPhase, reference: DayString): Promise<PhaseView> {
  const metrics = await db
    .select()
    .from(formPhaseMetrics)
    .where(eq(formPhaseMetrics.phaseId, row.id));

  // Ordered the way the interface reads them, not the way they were inserted.
  const order = new Map(METRICS.map((metric, index) => [metric, index]));
  metrics.sort((a, b) => (order.get(a.metric) ?? 99) - (order.get(b.metric) ?? 99));

  const end = row.endedDay ?? reference;
  return {
    ...row,
    metrics,
    dayNumber: Math.max(daysBetween(row.startDay, end) + 1, 1),
    totalDays: Math.max(daysBetween(row.startDay, row.targetDay) + 1, 1),
  };
}

export async function listPhases(): Promise<PhaseView[]> {
  const rows = await db.select().from(formPhases).orderBy(desc(formPhases.startDay));
  return Promise.all(rows.map((row) => decorate(row, today())));
}

/**
 * Close a phase.
 *
 * The final weight is frozen onto the row because it is the number the phase
 * will be remembered by, and re-deriving it from the log years later means
 * re-deciding what "final" meant every time the trend maths is touched.
 */
export async function completePhase(id: string, finalWeightG: number | null): Promise<void> {
  await db
    .update(formPhases)
    .set({
      status: 'completed',
      endedDay: today(),
      finalWeightG,
      updatedAt: Date.now(),
    })
    .where(eq(formPhases.id, id));
}

/** Push a phase's finishing line back without breaking its continuity (§100). */
export async function extendPhase(id: string, targetDay: DayString): Promise<void> {
  await db
    .update(formPhases)
    .set({ targetDay, updatedAt: Date.now() })
    .where(eq(formPhases.id, id));
}

export async function renamePhase(id: string, name: string, note: string | null): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  await db
    .update(formPhases)
    .set({ name: clean, note, updatedAt: Date.now() })
    .where(eq(formPhases.id, id));
}

// ------------------------------------------------------------------ targets

/**
 * Change a target, from today onward.
 *
 * Two writes, and both matter. The phase row moves so the interface shows the
 * new number; the history gains a row so that every day already lived keeps
 * being judged against the target it was actually lived against. Without the
 * second write, moving a calorie target on Thursday would silently rewrite
 * what Monday meant, which §61 calls out as the thing that makes a long
 * personal history worth nothing.
 */
export async function setTarget(
  phaseId: string,
  metric: Metric,
  target: number | null,
  direction?: TargetDirection,
  effectiveFrom: DayString = today(),
): Promise<void> {
  const [current] = await db
    .select()
    .from(formPhaseMetrics)
    .where(and(eq(formPhaseMetrics.phaseId, phaseId), eq(formPhaseMetrics.metric, metric)));
  if (!current) return;

  const nextDirection = direction ?? current.direction;

  await db
    .update(formPhaseMetrics)
    .set({ target, direction: nextDirection, updatedAt: Date.now() })
    .where(eq(formPhaseMetrics.id, current.id));

  await db
    .insert(formTargetHistory)
    .values({
      id: newFormId('fth'),
      phaseId,
      metric,
      target,
      direction: nextDirection,
      effectiveFrom,
    })
    // Changing the same target twice in one day is one decision, not two.
    .onConflictDoUpdate({
      target: [formTargetHistory.phaseId, formTargetHistory.metric, formTargetHistory.effectiveFrom],
      set: { target, direction: nextDirection },
    });
}

export async function setMetricEnabled(
  phaseId: string,
  metric: Metric,
  enabled: boolean,
): Promise<void> {
  await db
    .update(formPhaseMetrics)
    .set({ enabled, updatedAt: Date.now() })
    .where(and(eq(formPhaseMetrics.phaseId, phaseId), eq(formPhaseMetrics.metric, metric)));
}

/** Every target this phase has ever carried, oldest first, for judging past days. */
export async function targetHistory(phaseId: string) {
  return db
    .select()
    .from(formTargetHistory)
    .where(eq(formTargetHistory.phaseId, phaseId))
    .orderBy(asc(formTargetHistory.effectiveFrom));
}

/** A sensible finishing line for a phase of a given length, in weeks. */
export function targetDayFor(startDay: DayString, weeks: number): DayString {
  return addDays(startDay, Math.max(Math.round(weeks * 7), 7));
}
