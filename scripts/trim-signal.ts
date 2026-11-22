/**
 * Cut Signal's inbox back to the last few days.
 *
 *   npm run signal:trim                        preview: keep today and yesterday
 *   npm run signal:trim -- --days 3            preview: keep the last three days
 *   npm run signal:trim -- --since 2026-11-21  preview: keep everything from that day
 *   npm run signal:trim -- --yes               do it
 *
 * A preview is the default and changes nothing, the same convention as
 * `npm run db:reset`. Days are IST calendar days, and "which day" is the one the
 * inbox itself files an item under. Trimmed items are marked dismissed, not
 * deleted, so no later sync can bring them back. See `lib/signal/trim.ts`.
 *
 * Points at `DATABASE_URL` the way the app does, so it can be rehearsed on a
 * copy of the database first.
 */

import { DATABASE_URL } from '@/lib/db/client';
import { toDay } from '@/lib/date';
import { applyTrim, historyCutoff, planTrim, startOfDay } from '@/lib/signal/trim';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};

const label = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

async function main() {
  const since = flag('--since');
  const days = flag('--days');
  if (since && days) throw new Error('Give --since or --days, not both.');

  const cutoff = since ? startOfDay(since) : historyCutoff(days ? Number(days) : 2);
  const plan = await planTrim(cutoff);

  const byDay = new Map<string, number>();
  for (const { at } of plan.drop) {
    const day = toDay(new Date(at));
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  console.log(`database    ${DATABASE_URL}`);
  console.log(`keeping     everything filed on or after ${label.format(cutoff)} (IST)`);
  console.log(`waiting     ${plan.waiting}`);
  console.log(`to dismiss  ${plan.drop.length}`);
  for (const [day, count] of [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))) {
    console.log(`  ${label.format(startOfDay(day)).padEnd(12)} ${String(count).padStart(4)}`);
  }

  if (!args.includes('--yes')) {
    console.log('\nnothing was changed. re-run with --yes to dismiss them.');
    return;
  }

  const dismissed = await applyTrim(plan);
  console.log(`\ndismissed ${dismissed}. ${plan.waiting - dismissed} still waiting.`);
  console.log('they are marked dismissed rather than deleted, so a sync cannot bring them back.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
