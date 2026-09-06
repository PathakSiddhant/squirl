import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';

import { formProfile, type FormProfile } from './schema';

/**
 * The one row that describes the person.
 *
 * Read through a getter that creates it on first use rather than through a
 * seed script, for the same reason Signal's categories are: a setup step you
 * have to remember is a setup step that gets skipped and then reported as a
 * bug.
 */

const ME = 'me';

export type Profile = FormProfile;

export async function getProfile(): Promise<Profile> {
  const [existing] = await db.select().from(formProfile).where(eq(formProfile.id, ME));
  if (existing) return existing;

  await db.insert(formProfile).values({ id: ME }).onConflictDoNothing();
  const [created] = await db.select().from(formProfile).where(eq(formProfile.id, ME));
  return created;
}

export async function updateProfile(patch: Partial<Omit<FormProfile, 'id'>>): Promise<void> {
  await getProfile();
  await db
    .update(formProfile)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(formProfile.id, ME));
}

/** The shape the calculation layer wants, assembled from the profile and a weight. */
export function bodyOf(profile: Profile, weightG: number) {
  return {
    weightG,
    heightMm: profile.heightMm,
    birthYear: profile.birthYear,
    sex: profile.sex,
    activity: profile.activity,
  };
}
