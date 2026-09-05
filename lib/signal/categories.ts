import { db } from '@/lib/db/client';

import { newSignalId } from './id';
import { signalCategories } from './schema';

/**
 * The categories Signal starts with.
 *
 * Broad on purpose. These answer "what kind of thing is this channel about"
 * at the level a person actually sorts by, and the narrower distinctions
 * (cricket, F1, AI, hardware) are topics, which is a different table because a
 * channel genuinely has several of those and only one of these.
 *
 * They are seeded as rows rather than fixed as an enum because the classifier
 * that assigns them is guessing, and a guess the reader cannot correct is a
 * guess that stays wrong. `slug` is the stable handle: renaming "Technology"
 * to "Tech" changes the label and breaks nothing.
 */
export const DEFAULT_CATEGORIES = [
  { slug: 'technology', name: 'Technology' },
  { slug: 'programming', name: 'Programming' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'news', name: 'News' },
  { slug: 'politics', name: 'Politics' },
  { slug: 'business', name: 'Business' },
  { slug: 'science', name: 'Science' },
  { slug: 'gaming', name: 'Gaming' },
  { slug: 'entertainment', name: 'Entertainment' },
  { slug: 'education', name: 'Education' },
  { slug: 'film-tv', name: 'Film & TV' },
  { slug: 'music', name: 'Music' },
  // The honest bucket. A channel that does not fit is put here rather than
  // forced into the nearest wrong one, and it is visibly "uncategorised"
  // rather than quietly mislabelled.
  { slug: 'other', name: 'Other' },
] as const;

export type CategorySlug = (typeof DEFAULT_CATEGORIES)[number]['slug'];

/**
 * Makes sure the default set exists, and returns every category.
 *
 * Idempotent, and safe to call on any path that needs categories: it inserts
 * only what is missing and never rewrites a row, so a category the reader has
 * renamed survives. Called lazily rather than from a seed script, because a
 * setup step you have to remember is a setup step that gets skipped and then
 * reported as a bug.
 */
export async function ensureCategories() {
  const existing = await db.select().from(signalCategories);
  const known = new Set(existing.map((row) => row.slug));

  const missing = DEFAULT_CATEGORIES.filter((entry) => !known.has(entry.slug)).map(
    (entry, index) => ({
      id: newSignalId('scat'),
      name: entry.name,
      slug: entry.slug,
      position: known.size + index,
    }),
  );

  if (missing.length > 0) await db.insert(signalCategories).values(missing);

  return db.select().from(signalCategories).orderBy(signalCategories.position);
}
