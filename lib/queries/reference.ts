import { asc, isNull } from 'drizzle-orm';

import { db } from '../db/client';
import { accounts, categories, people, settings } from '../db/schema';
import { SEED_SETTINGS } from '../db/seed-data';

/** Lookup data every page needs: accounts, categories, people, preferences. */

export async function getAccounts() {
  return db.select().from(accounts).where(isNull(accounts.archivedAt)).orderBy(asc(accounts.sortOrder));
}

export async function getAllAccounts() {
  return db.select().from(accounts).orderBy(asc(accounts.sortOrder));
}

export async function getCategories() {
  return db
    .select()
    .from(categories)
    .where(isNull(categories.archivedAt))
    .orderBy(asc(categories.sortOrder));
}

export async function getPeople() {
  return db.select().from(people).where(isNull(people.archivedAt)).orderBy(asc(people.name));
}

export interface Preferences {
  horizonDays: number;
  buffer: number;
  burnWindowDays: number;
  theme: string;
  onboarded: boolean;
}

export async function getPreferences(): Promise<Preferences> {
  const rows = await db.select().from(settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const read = (key: keyof typeof SEED_SETTINGS) => map.get(key) ?? SEED_SETTINGS[key];

  return {
    horizonDays: Number(read('horizonDays')) || 30,
    buffer: Number(read('buffer')) || 0,
    burnWindowDays: Number(read('burnWindowDays')) || 7,
    theme: read('theme'),
    onboarded: read('onboarded') === 'true',
  };
}

/** Everything the quick-capture parser needs to resolve names to ids. */
export async function getCaptureContext() {
  const [peopleRows, categoryRows, accountRows] = await Promise.all([
    getPeople(),
    getCategories(),
    getAccounts(),
  ]);

  return {
    people: peopleRows.map((p) => ({ id: p.id, name: p.name, handle: p.handle })),
    categories: categoryRows.map((c) => ({
      id: c.id,
      name: c.name,
      flow: c.flow,
      keywords: c.keywords,
    })),
    accounts: accountRows.map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
  };
}
