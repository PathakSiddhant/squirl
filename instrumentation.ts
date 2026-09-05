/**
 * Squirl's process starting up.
 *
 * Next calls `register` once per server process, before it serves anything.
 * It is the only hook that runs without a request, which makes it the only
 * place a background worker can be started: everything else in the App Router
 * happens because somebody asked for a page, and Signal has to keep syncing
 * when nobody has.
 *
 * Guarded on the runtime. Next also evaluates this file for the edge runtime,
 * where there are no timers to keep and no database to write to, and starting
 * a scheduler there would be starting one that cannot work.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { startScheduler } = await import('@/lib/signal/scheduler');
  startScheduler();
}
