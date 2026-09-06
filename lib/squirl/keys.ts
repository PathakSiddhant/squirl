/**
 * Credential pools, and rotation across them.
 *
 * Lives in `lib/squirl/` rather than inside an application because it now has
 * two consumers: Signal classifies channels with Gemini, and Form explains a
 * goal with it. ARCHITECTURE.md's first rule is to extract to shared only on
 * the *second* real use, and this is that second use — before Form existed
 * this file was Signal's and moving it would have been guessing.
 *
 * It stays deliberately small. This knows about keys and cooldowns; it knows
 * nothing about videos, bodies, or what either application asks a model for.
 *
 * Every key here is on a free tier, which means the limit is not money but a
 * daily and per-minute ceiling per project. Several keys from several projects
 * therefore multiply the ceiling, and more usefully they remove the single
 * point of failure: one key hitting its limit stops that key, not Signal.
 *
 * Rotation is round-robin from a cursor held on globalThis, so it survives
 * Next's module reloading in development the way the database client does.
 * There is no cleverness about which key is "best": they are interchangeable,
 * and the only thing worth tracking is which ones are currently exhausted.
 */

interface Pool {
  keys: string[];
  cursor: number;
  /** Key -> the moment it may be tried again. Cleared by a success. */
  cooling: Map<string, number>;
}

declare global {
  // eslint-disable-next-line no-var
  var __signalKeyPools: Map<string, Pool> | undefined;
}

function pool(name: string, raw: string | undefined): Pool {
  globalThis.__signalKeyPools ??= new Map();

  let existing = globalThis.__signalKeyPools.get(name);
  if (!existing) {
    existing = {
      keys: (raw ?? '')
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean),
      cursor: 0,
      cooling: new Map(),
    };
    globalThis.__signalKeyPools.set(name, existing);
  }
  return existing;
}

const youtube = () => pool('youtube', process.env.YOUTUBE_API_KEYS ?? process.env.YOUTUBE_API_KEY);
const gemini = () => pool('gemini', process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY);

function usable(p: Pool): string[] {
  const now = Date.now();
  const ready = p.keys.filter((key) => (p.cooling.get(key) ?? 0) <= now);
  // If everything is cooling, hand back the whole set rather than nothing: a
  // request that fails with a clear quota error is more useful than a request
  // that was never made and reports a missing key.
  return ready.length > 0 ? ready : p.keys;
}

/** The next key to try, or null when none is configured. */
export function nextKey(service: 'youtube' | 'gemini'): string | null {
  const p = service === 'youtube' ? youtube() : gemini();
  const ready = usable(p);
  if (ready.length === 0) return null;

  const key = ready[p.cursor % ready.length];
  p.cursor = (p.cursor + 1) % Math.max(ready.length, 1);
  return key;
}

/** How many keys are configured, so a caller knows how many times to retry. */
export function keyCount(service: 'youtube' | 'gemini'): number {
  return (service === 'youtube' ? youtube() : gemini()).keys.length;
}

/**
 * Take a key out of rotation for a while.
 *
 * Used when a key reports its quota is gone. The default rest is until a
 * little after midnight Pacific, which is when Google's daily quotas reset,
 * because trying an exhausted key again in five minutes only wastes the
 * request.
 */
export function restKey(service: 'youtube' | 'gemini', key: string, until?: number): void {
  const p = service === 'youtube' ? youtube() : gemini();
  p.cooling.set(key, until ?? nextPacificMidnight());
}

export function releaseKey(service: 'youtube' | 'gemini', key: string): void {
  const p = service === 'youtube' ? youtube() : gemini();
  p.cooling.delete(key);
}

function nextPacificMidnight(): number {
  // Pacific is UTC-8, or UTC-7 in summer. Eight is the safe assumption: it
  // errs towards waiting slightly longer, and waiting slightly longer costs
  // nothing while retrying too early costs a wasted call every time.
  const now = new Date();
  const pacific = new Date(now.getTime() - 8 * 3_600_000);
  pacific.setUTCHours(24, 5, 0, 0);
  return pacific.getTime() + 8 * 3_600_000;
}
