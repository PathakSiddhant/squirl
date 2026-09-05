import { CaretLeft } from '@phosphor-icons/react/dist/ssr/CaretLeft';
import Link from 'next/link';

import { AppMark } from '@/components/brand/logo';
import { SignalNav } from '@/components/signal/signal-nav';

/**
 * Signal's own shell.
 *
 * Deliberately not Ledger's. Ledger is a workspace you sit down in, so it
 * wears a full sidebar of destinations; Signal is a thing you pass through,
 * and its whole job is to be emptied and closed. So the chrome is one quiet
 * bar, and everything else on the screen is content.
 *
 * The mark goes to Signal's own inbox, and the way back to Squirl is its own
 * separate control. Hanging both on one element meant the obvious click, the
 * product's own logo, threw you out of the product.
 */
export default function SignalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-signal flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[72rem] items-center gap-3 px-5 py-3 sm:px-8">
          <Link
            href="/"
            title="Back to Squirl"
            aria-label="Back to Squirl"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink"
          >
            <CaretLeft size={14} weight="bold" />
          </Link>

          <Link
            href="/signal"
            className="flex shrink-0 items-center gap-2.5 text-ink transition-opacity duration-[var(--t-state)] hover:opacity-70"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--app-accent-wash)]">
              <AppMark name="signal-mark" size={18} />
            </span>
            <span className="hidden text-[0.9375rem] font-semibold tracking-[-0.01em] sm:block">
              Signal
            </span>
          </Link>

          <SignalNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[72rem] flex-1 px-5 pb-16 pt-6 sm:px-8">{children}</main>
    </div>
  );
}
