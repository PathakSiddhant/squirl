import { Lock } from '@phosphor-icons/react/dist/ssr/Lock';
import Link from 'next/link';

import { signOut } from '@/app/actions/session';
import { LedgerMark, Lockup } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { Button } from '@/components/ui/button';
import { formatDayLong, today } from '@/lib/date';
import { APPS, type AppSignal, type SquirlApp } from '@/lib/squirl/apps';

export const metadata = { title: 'Home' };

/**
 * An application's own figure must never take the launcher down with it. A
 * failed read means that card shows no number, not that Squirl fails to open.
 */
async function readSignal(app: SquirlApp): Promise<AppSignal | null> {
  try {
    return await app.signal();
  } catch {
    return null;
  }
}

/**
 * Squirl's home.
 *
 * Not a dashboard. A dashboard answers questions, and this screen has no
 * questions to answer: the applications answer them. So it is a room with the
 * things Squirl keeps sitting on a shelf in it, with enough air that opening
 * one is the only thing there is to do.
 *
 * Each application sits on a hairline rather than inside a card, and the
 * hairline under it takes that application's own colour when you reach for it.
 * That is the accent doing identification, which is the only job it has.
 */
export default async function SquirlHome() {
  const cards = await Promise.all(APPS.map(async (app) => ({ app, signal: await readSignal(app) })));

  return (
    <main className="lock-bg flex min-h-dvh flex-col">
      <header className="relative z-10 mx-auto flex w-full max-w-[50rem] items-center justify-between px-6 pt-7">
        <Lockup size={58} alt="Squirl" />
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon" title="Lock Squirl" aria-label="Lock Squirl">
              <Lock size={15} />
            </Button>
          </form>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-[50rem] flex-1 flex-col justify-center px-6 py-14">
        <p className="rise text-[0.8125rem] text-ink-3" style={{ animationDelay: '60ms' }}>
          {formatDayLong(today())}
        </p>

        <ul className="rise mt-7 border-t border-line" style={{ animationDelay: '140ms' }}>
          {cards.map(({ app, signal }) => (
            <li key={app.id} className={app.accentClass}>
              <Link
                href={app.href}
                className="group relative flex items-center gap-5 py-6 transition-transform duration-[var(--t-move)] ease-[var(--ease)] hover:-translate-y-px"
              >
                <span className="flex size-[3.25rem] shrink-0 items-center justify-center rounded-md bg-[var(--app-accent-wash)]">
                  <LedgerMark size={30} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[1.375rem] font-semibold leading-tight tracking-[-0.01em] text-ink">
                    {app.name}
                  </span>
                  <span className="mt-1 block text-[0.875rem] leading-relaxed text-ink-3">
                    {app.tagline}
                  </span>
                </span>

                {signal ? (
                  <span className="shrink-0 pl-4 text-right">
                    <span
                      className={`money block text-[1.25rem] leading-tight ${
                        signal.tone === 'attention' ? 'text-[var(--i-owe-text)]' : 'text-ink'
                      }`}
                    >
                      {signal.value}
                    </span>
                    <span className="mt-1 block text-[0.75rem] text-ink-3">{signal.label}</span>
                  </span>
                ) : null}

                {/* The shelf the application stands on, which lights up in that
                    application's own colour when you reach for it. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-px bg-line transition-colors duration-[var(--t-move)] group-hover:bg-[var(--app-accent)] group-focus-visible:bg-[var(--app-accent)]"
                />
              </Link>
            </li>
          ))}
        </ul>

        <footer
          className="rise mt-12 max-w-[34rem] text-[0.75rem] leading-relaxed text-ink-3"
          style={{ animationDelay: `${140 + cards.length * 70 + 60}ms` }}
        >
          <p>
            One application so far. Squirl is the place they live, not a bundle of things you did
            not ask for, so the next one arrives when there is something worth building.
          </p>
          <p className="mt-2">
            Everything is in <code className="font-mono text-ink-2">data/squirl.db</code> on this
            machine. No account, no server, nothing leaves.
          </p>
        </footer>
      </div>
    </main>
  );
}
