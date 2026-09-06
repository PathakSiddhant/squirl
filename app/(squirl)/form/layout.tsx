import { CaretLeft } from '@phosphor-icons/react/dist/ssr/CaretLeft';
import { GearSix } from '@phosphor-icons/react/dist/ssr/GearSix';
import Link from 'next/link';

import { AppMark } from '@/components/brand/logo';
import { FormNav } from '@/components/form/form-nav';
import { IST_TIME_ZONE, today } from '@/lib/date';

/**
 * Form's own shell.
 *
 * ## One object, not a window with bars on it
 *
 * The earlier frame was a header, a row of tabs and a hairline rule, which is
 * the frame every web application has had since 2011. This one has no edges at
 * all: a single floating plaque carries the mark, the destinations and the
 * date, and the page floats underneath it on a blush ground.
 *
 * A bottom dock was tried in between and thrown out. It put navigation at the
 * far end of a page you then had to scroll, and a frosted pill with a coloured
 * capsule in it is the most copied shape of the last three years — the exact
 * house style this application exists to avoid.
 *
 * The phase used to be drawn up here as a strip. It is a fact about the body,
 * not about the window, so it moved down into Today where it can be a real
 * object instead of a line of text wedged under the chrome.
 */
export default async function FormLayout({ children }: { children: React.ReactNode }) {
  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  void today();

  return (
    <div className="form-app flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-sticky px-4 pt-4 sm:px-7">
        <div className="form-plaque mx-auto flex w-full max-w-[102rem] items-center gap-3 rounded-[1.75rem] py-2.5 pl-2.5 pr-3">
          <Link
            href="/"
            title="Back to Squirl"
            aria-label="Back to Squirl"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 transition-[color,background-color] duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink"
          >
            <CaretLeft size={16} weight="bold" />
          </Link>

          {/* The mark, at a size that reads as a logo rather than a favicon. */}
          <Link href="/form" aria-label="Form" className="group flex shrink-0 items-center gap-2.5">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--app-accent-wash)] transition-transform duration-[var(--t-hover)] ease-[var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-105">
              <AppMark name="form-mark" size={26} />
            </span>
            <span className="font-serif text-[1.5rem] leading-none tracking-[-0.03em] text-ink">
              Form
            </span>
          </Link>

          <div className="ml-2 hidden min-w-0 flex-1 md:block">
            <FormNav />
          </div>

          <span className="flex-1 md:hidden" />

          <p className="hidden shrink-0 pr-1 text-[0.8125rem] text-ink-2 lg:block">{dateLabel}</p>

          <Link
            href="/form/settings"
            title="Settings"
            aria-label="Settings"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 transition-[color,background-color,rotate] duration-[var(--t-hover)] hover:bg-surface-2 hover:text-ink hover:rotate-45"
          >
            <GearSix size={17} />
          </Link>
        </div>

        {/* Narrow screens get the same slot nav on its own line under the plaque. */}
        <div className="form-plaque mx-auto mt-2 w-full max-w-[102rem] rounded-full px-2 py-1.5 md:hidden">
          <FormNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[102rem] flex-1 px-4 pb-16 pt-5 sm:px-7">{children}</main>
    </div>
  );
}
