import { statSync } from 'node:fs';
import { join } from 'node:path';

import { Launcher } from '@/components/squirl/launcher';
import type { LauncherApp } from '@/components/squirl/launcher-app';
import type { StorageFacts } from '@/components/squirl/storage-sheet';
import { formatDayLong, IST_TIME_ZONE, today } from '@/lib/date';
import { APPS, type AppSnapshot, type SquirlApp } from '@/lib/squirl/apps';
import { deskPhase, type DeskPhase } from '@/lib/squirl/phase';

export const metadata = { title: 'Home' };

/**
 * An application's own figures must never take the launcher down with them. A
 * failed read means that tile shows no numbers, not that Squirl fails to open.
 */
async function readSnapshot(app: SquirlApp): Promise<AppSnapshot | null> {
  if (!app.snapshot) return null;
  try {
    return await app.snapshot();
  } catch {
    return null;
  }
}

/**
 * Facts about the file everything lives in.
 *
 * Read off disk, not asserted. There is no backup system here, so this does
 * not claim one: it reports where the file is, how big it has got, and when it
 * was last written, which is what you would want to know before copying it.
 */
function storage(): StorageFacts | null {
  try {
    const file = statSync(join(process.cwd(), 'data', 'squirl.db'));
    const mb = file.size / (1024 * 1024);
    return {
      size: mb < 1 ? `${Math.round(file.size / 1024)} KB` : `${mb.toFixed(1)} MB`,
      written: new Intl.DateTimeFormat('en-IN', {
        timeZone: IST_TIME_ZONE,
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(file.mtime),
    };
  } catch {
    return null;
  }
}

/**
 * The hour, said out loud.
 *
 * Squirl already resolves the part of the day to light the room by. Saying it
 * costs nothing, and it is the difference between a product greeting a user
 * and a place you came back to.
 */
const GREETING: Record<DeskPhase, string> = {
  dawn: 'Good morning',
  day: 'Good afternoon',
  dusk: 'Good evening',
  night: 'Still up',
};

/**
 * Squirl's home.
 *
 * One screen, and it never scrolls. The mark and the hour at the top, the
 * shelf of applications in the middle, and every Squirl-level control on one
 * row where it can be seen: how to look at the shelf, the way into everything,
 * the theme, the file, and the lock.
 *
 * What used to be here was a rail of icons down the left and a paragraph of
 * storage facts along the bottom. The rail is the shape that fails first, a
 * column of destinations drawn at all times that a fourth application turns
 * into a column with a scrollbar, and the paragraph spent the foot of the
 * screen restating a claim that the badge above it already makes. Both are
 * gone: the claim is a chip, the detail is behind the button next to it.
 */
export default async function SquirlHome() {
  const phase = deskPhase();
  const file = storage();

  // Read on the server and handed over flat: SquirlApp carries a snapshot
  // function, and a function cannot cross into a client component.
  const apps: LauncherApp[] = await Promise.all(
    APPS.map(async (app) => ({
      id: app.id,
      name: app.name,
      tagline: app.tagline,
      note: app.note,
      mark: app.mark,
      accentClass: app.accentClass,
      status: app.status,
      href: app.href,
      snapshot: await readSnapshot(app),
    })),
  );

  return (
    <main data-phase={phase} className="desk relative min-h-dvh overflow-hidden">
      <span className="desk-light" aria-hidden="true" />

      <div className="relative z-10 mx-auto w-full max-w-[68rem]">
        <Launcher
          apps={apps}
          storage={file}
          greeting={GREETING[phase]}
          date={formatDayLong(today())}
          phase={phase}
        />
      </div>
    </main>
  );
}
