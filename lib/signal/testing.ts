import { mkdirSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * A throwaway database for a test, built by the real migrations.
 *
 * The application's database client reads `DATABASE_URL` once, when it is first
 * imported, so this has to run before anything that imports `@/lib/db/client`.
 * A test file calls it first and then pulls the modules under test in with a
 * dynamic `import()`. Each file runs in its own process under `node --test`, so
 * one file's database never leaks into another's.
 *
 * Running the migrations rather than hand-writing the tables is deliberate: the
 * schema these tests exercise is the one that will actually ship, and a
 * migration that does not apply cleanly fails here instead of on somebody's
 * machine.
 */

const ROOT = path.join(tmpdir(), 'squirl-test');

/**
 * Remove what earlier runs could not.
 *
 * On Windows the database file stays locked after the client closes, for longer
 * than a test is worth waiting, so a run's own cleanup is a single best-effort
 * attempt and the folder it could not remove is swept by the next run, once the
 * process that held it has exited. The age check keeps a sweep from touching
 * the folders other test files in this same run are using right now.
 */
async function sweepStale(): Promise<void> {
  mkdirSync(ROOT, { recursive: true });
  for (const entry of readdirSync(ROOT)) {
    const full = path.join(ROOT, entry);
    try {
      if (Date.now() - statSync(full).mtimeMs > 60_000) await rm(full, { recursive: true, force: true });
    } catch {
      // Still held by a run that has not exited. The next sweep gets it.
    }
  }
}

export async function useTempDatabase(): Promise<{ cleanup: () => Promise<void> }> {
  await sweepStale();

  const dir = mkdtempSync(path.join(ROOT, 'db-'));
  // Forward slashes: a Windows drive path with backslashes is not a valid file URL.
  process.env.DATABASE_URL = `file:${path.join(dir, 'test.db').replaceAll('\\', '/')}`;

  const { db } = await import('@/lib/db/client');
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'lib/db/migrations') });

  return {
    cleanup: async () => {
      globalThis.__squirlClient?.close();
      await rm(dir, { recursive: true, force: true }).catch(() => {
        // Locked until this process exits. See `sweepStale`.
      });
    },
  };
}
