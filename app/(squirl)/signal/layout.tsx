import { CaretLeft } from '@phosphor-icons/react/dist/ssr/CaretLeft';
import Link from 'next/link';

import { AppMark, SignalWordmark } from '@/components/brand/logo';
import { AutoRefresh } from '@/components/signal/auto-refresh';
import { SignalNav } from '@/components/signal/signal-nav';
import { SyncButton } from '@/components/signal/sync-button';

/**
 * Signal's own shell.
 *
 * Deliberately not Ledger's. Ledger is a workspace you sit down in, so it wears
 * a full sidebar of destinations; Signal is a thing you pass through, and its
 * job is to be emptied and closed. One quiet bar, and everything else on the
 * screen is content.
 *
 * The identity sits in the middle of that bar rather than in the top left
 * corner. The corner is where every application in the world puts its logo,
 * Ledger included, and Signal putting it there too is most of why the two
 * looked like the same product. Centred, it also gets to be larger without
 * crowding the controls, because the space on either side of it is doing
 * nothing else.
 *
 * A three-column grid rather than flexbox with spacers: the mark stays on the
 * window's centre line regardless of how wide the nav on the left happens to
 * be, which a `justify-between` row cannot promise.
 */
export default function SignalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-signal flex min-h-dvh flex-col">
      <AutoRefresh />

      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto grid w-full max-w-[76rem] grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-4 sm:px-10">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              href="/"
              title="Back to Squirl"
              aria-label="Back to Squirl"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink"
            >
              <CaretLeft size={17} weight="bold" />
            </Link>

            <SignalNav />
          </div>

          <Link
            href="/signal"
            aria-label="Signal"
            className="flex shrink-0 items-center gap-2.5 transition-opacity duration-[var(--t-state)] hover:opacity-70"
          >
            <AppMark name="signal-mark" size={34} />
            <SignalWordmark size={17} className="hidden sm:block" />
          </Link>

          <div className="flex items-center justify-end">
            <SyncButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[76rem] flex-1 px-6 pb-20 pt-8 sm:px-10">{children}</main>
    </div>
  );
}
