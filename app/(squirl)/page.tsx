import { statSync } from 'node:fs';
import { join } from 'node:path';

import { ClockCounterClockwise } from '@phosphor-icons/react/dist/ssr/ClockCounterClockwise';
import { Database } from '@phosphor-icons/react/dist/ssr/Database';
import { HardDrives } from '@phosphor-icons/react/dist/ssr/HardDrives';
import { Lock } from '@phosphor-icons/react/dist/ssr/Lock';

import { signOut } from '@/app/actions/session';
import { Lockup } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { AppCard } from '@/components/squirl/app-card';
import { Orbit } from '@/components/squirl/orbit';
import { Rail } from '@/components/squirl/rail';
import { Button } from '@/components/ui/button';
import { formatDayLong, IST_TIME_ZONE, today } from '@/lib/date';
import { APPS, type AppSnapshot, type SquirlApp } from '@/lib/squirl/apps';
import { deskPhase } from '@/lib/squirl/phase';

export const metadata = { title: 'Home' };

/**
 * An application's own figures must never take the launcher down with them. A
 * failed read means that card shows no numbers, not that Squirl fails to open.
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
function storage(): { size: string; written: string } | null {
  try {
    const file = statSync(join(process.cwd(), 'data', 'squirl.db'));
    const mb = file.size / (1024 * 1024);
    return {
      size: mb < 1 ? `${Math.round(file.size / 1024)} KB` : `${mb.toFixed(1)} MB`,
      written: new Intl.DateTimeFormat('en-IN', {
        timeZone: IST_TIME_ZONE,
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(file.mtime),
    };
  } catch {
    return null;
  }
}

/**
 * Squirl's home.
 *
 * Not a dashboard: it has no subject of its own to report on. It is the place
 * the applications live, so it shows each of them exactly as it stands right
 * now and then gets out of the way. Every figure here is read live from the
 * application it belongs to, and an application with nothing behind it shows
 * nothing rather than a convincing placeholder.
 */
export default async function SquirlHome() {
  const cards = await Promise.all(
    APPS.map(async (app) => ({ app, snapshot: await readSnapshot(app) })),
  );
  const file = storage();

  const facts = [
    {
      icon: Database,
      label: 'Where it lives',
      value: 'data/squirl.db',
      note: 'On this machine, nowhere else',
      mono: true,
    },
    {
      icon: HardDrives,
      label: 'Size on disk',
      value: file ? file.size : 'not created yet',
      note: 'Everything, across every application',
      mono: false,
    },
    {
      icon: ClockCounterClockwise,
      label: 'Last written',
      value: file ? file.written : 'never',
      note: 'Copy the file and you have a backup',
      mono: false,
    },
  ];

  return (
    <main data-phase={deskPhase()} className="desk min-h-dvh">
      <Rail />

      {/* The rail is desktop only, so the controls it holds need a home on a
          phone. This bar is that, and nothing else. */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-4 lg:hidden">
        <Lockup size={44} alt="Squirl" />
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon" title="Lock Squirl" aria-label="Lock Squirl">
              <Lock size={15} />
            </Button>
          </form>
        </div>
      </header>

      <div className="relative z-10 lg:pl-[8.75rem]">
        <div className="mx-auto w-full max-w-[72rem] px-5 py-10 sm:px-8 lg:py-14">
          <div className="flex items-start justify-between gap-10">
            <div className="rise min-w-0" style={{ animationDelay: '40ms' }}>
              <h1 className="font-serif text-[2.75rem] font-normal leading-[1.04] tracking-[-0.02em] text-ink sm:text-[3.25rem]">
                Welcome to
                <br />
                <span className="text-[var(--cta)]">Squirl.</span>
              </h1>
              <span className="mt-5 block h-px w-10 bg-line-strong" />
              <p className="mt-5 text-[1.0625rem] leading-relaxed text-ink-2">
                Your space. Your data.
                <br />
                All of it lives with <span className="text-[var(--cta)]">you.</span>
              </p>
              <p className="mt-6 text-[0.8125rem] text-ink-3">{formatDayLong(today())}</p>
            </div>

            <div className="rise hidden xl:block" style={{ animationDelay: '150ms' }}>
              <Orbit />
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            {cards.map(({ app, snapshot }, index) => (
              <AppCard key={app.id} app={app} snapshot={snapshot} delay={220 + index * 90} />
            ))}
          </div>

          <section
            className="rise mt-4 rounded-xl border border-line bg-surface p-6"
            style={{ animationDelay: `${220 + cards.length * 90 + 70}ms` }}
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,15rem)_1fr] lg:gap-10">
              <p className="font-serif text-[1.125rem] leading-snug text-ink">
                Nothing here is guessed. Every number is replayed from what you wrote down.
              </p>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:divide-x sm:divide-line">
                {facts.map((fact, index) => (
                  <div
                    key={fact.label}
                    className={`flex items-start gap-3 ${index === 0 ? 'sm:pr-5' : 'sm:px-5'}`}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                      <fact.icon size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.75rem] text-ink-3">{fact.label}</span>
                      <span
                        className={`mt-1 block truncate text-[0.875rem] text-ink ${fact.mono ? 'font-mono text-[0.8125rem]' : ''}`}
                      >
                        {fact.value}
                      </span>
                      <span className="mt-1 block text-[0.75rem] leading-relaxed text-ink-3">
                        {fact.note}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
