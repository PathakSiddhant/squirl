import { desc } from 'drizzle-orm';

import { NotesBoard } from '@/components/form/notes-board';
import { db } from '@/lib/db/client';
import { listPhases } from '@/lib/form/phases';
import { formNotes } from '@/lib/form/schema';

export const metadata = { title: 'Notes · Form' };
export const dynamic = 'force-dynamic';

/**
 * What was learned.
 *
 * Not a journal and not a second product (§55). These are the handful of
 * sentences worth reading at the start of the next phase — "cutting hard
 * wrecked my sleep" — and they outlive the phase that produced them, which is
 * why they belong to Form rather than to any one of them.
 */
export default async function FormNotes() {
  const [notes, phases] = await Promise.all([
    db.select().from(formNotes).orderBy(desc(formNotes.pinned), desc(formNotes.createdAt)),
    listPhases(),
  ]);

  return (
    <NotesBoard
      notes={notes}
      phases={phases.map((phase) => ({ id: phase.id, name: phase.name }))}
    />
  );
}
