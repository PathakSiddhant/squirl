import { and, asc, desc, eq, isNull, like, or, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';

import { portion, type Nutrients, type Reference } from './food';
import { newFormId } from './id';
import { formFoods, type Confidence, type FoodUnit, type FormFood } from './schema';

/**
 * The personal food library.
 *
 * Personal, and only personal (§93). There is no public database to search, no
 * barcode index and no crowd-sourced entries of uncertain provenance — this is
 * the twenty or thirty things actually eaten week after week, entered once with
 * the packet in hand and then reused for years.
 *
 * That constraint is what makes the whole feature fast. A library this size can
 * be ordered by how recently and how often each thing was eaten, which means
 * the oats are the first row every morning without anybody arranging them.
 */

/** A library row, exactly as stored. Aliased so callers need not know that. */
export type FoodView = FormFood;

/**
 * The library, most useful first.
 *
 * Recency outranks frequency on purpose: something eaten every day for a year
 * and then stopped should fall away, and something started this week should
 * rise immediately. A food never yet used sorts by name, so a freshly added
 * one is findable rather than buried at the bottom.
 */
export async function listFoods(search = ''): Promise<FoodView[]> {
  const term = search.trim().toLowerCase();

  const rows = await db
    .select()
    .from(formFoods)
    .where(
      term
        ? and(
            isNull(formFoods.archivedAt),
            or(
              sql`lower(${formFoods.name}) like ${`%${term}%`}`,
              sql`lower(coalesce(${formFoods.brand}, '')) like ${`%${term}%`}`,
            ),
          )
        : isNull(formFoods.archivedAt),
    )
    .orderBy(desc(formFoods.lastUsedAt), desc(formFoods.useCount), asc(formFoods.name));

  return rows;
}

export async function getFood(id: string): Promise<FoodView | null> {
  const [row] = await db.select().from(formFoods).where(eq(formFoods.id, id));
  return row ?? null;
}

export interface FoodInput {
  name: string;
  brand: string | null;
  refQuantity: number;
  refUnit: FoodUnit;
  energyMcal: number;
  proteinMg: number;
  carbsMg: number | null;
  fatMg: number | null;
  fiberMg: number | null;
  confidence: Confidence;
  image?: string | null;
}

export async function createFood(input: FoodInput): Promise<string> {
  const id = newFormId('ffd');
  await db.insert(formFoods).values({ id, ...input, name: input.name.trim() });
  return id;
}

/**
 * Edit a food.
 *
 * Only the library entry changes. Every row already written into a day keeps
 * the numbers it was written with, because those were copied at log time — so
 * correcting a packet's protein figure today does not quietly rewrite what
 * last March's breakfasts contained.
 */
export async function updateFood(id: string, input: Partial<FoodInput>): Promise<void> {
  await db
    .update(formFoods)
    .set({ ...input, updatedAt: Date.now() })
    .where(eq(formFoods.id, id));
}

/**
 * Remove a food from the library.
 *
 * A hard delete, and safe: the food-log rows that referenced it carry their own
 * name and their own numbers, and the foreign key is `set null`, so history
 * survives its source disappearing.
 */
export async function deleteFood(id: string): Promise<void> {
  await db.delete(formFoods).where(eq(formFoods.id, id));
}

/** Same food, new row. For the two yoghurts that differ only in flavour. */
export async function duplicateFood(id: string): Promise<string | null> {
  const food = await getFood(id);
  if (!food) return null;

  return createFood({
    name: `${food.name} copy`,
    brand: food.brand,
    refQuantity: food.refQuantity,
    refUnit: food.refUnit,
    energyMcal: food.energyMcal,
    proteinMg: food.proteinMg,
    carbsMg: food.carbsMg,
    fatMg: food.fatMg,
    fiberMg: food.fiberMg,
    confidence: food.confidence,
  });
}

/** A saved food as the reference the portion maths wants. */
export function referenceOf(food: FormFood): Reference {
  return {
    refQuantity: food.refQuantity,
    refUnit: food.refUnit,
    energyMcal: food.energyMcal,
    proteinMg: food.proteinMg,
    carbsMg: food.carbsMg,
    fatMg: food.fatMg,
    fiberMg: food.fiberMg,
  };
}

/** What a given amount of a saved food comes to. */
export function portionOf(food: FormFood, quantity: number): Nutrients {
  return portion(referenceOf(food), quantity);
}

/** How many foods there are, for an empty state that knows which one to show. */
export async function countFoods(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(formFoods)
    .where(isNull(formFoods.archivedAt));
  return Number(row?.n ?? 0);
}

/** Anything matching a name, for the quick-log field to offer as you type. */
export async function suggestFoods(term: string, limit = 6): Promise<FoodView[]> {
  const clean = term.trim().toLowerCase();
  if (!clean) return [];

  return db
    .select()
    .from(formFoods)
    .where(and(isNull(formFoods.archivedAt), like(sql`lower(${formFoods.name})`, `%${clean}%`)))
    .orderBy(desc(formFoods.lastUsedAt), desc(formFoods.useCount))
    .limit(limit);
}
