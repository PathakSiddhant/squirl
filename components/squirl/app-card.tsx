import { ArrowRight } from '@phosphor-icons/react/dist/ssr/ArrowRight';
import Link from 'next/link';

import { AppMark } from '@/components/brand/logo';
import { cn } from '@/lib/cn';
import type { AppSnapshot, SquirlApp } from '@/lib/squirl/apps';

import { Spark } from './spark';

/**
 * Contour bands in the application's own accent, bled off the top right.
 *
 * The one piece of ornament on the card. It is here because a card that is
 * nothing but a header and a table of numbers reads as a spreadsheet row, and
 * because it is the largest surface where an application's colour can be felt
 * without colouring any of its data.
 *
 * It is masked out towards its foot. These are filled shapes, and clipping
 * them at a fixed height instead left a hard horizontal edge running straight
 * through the middle of the card.
 */
function Contours() {
  return (
    <svg
      viewBox="0 0 320 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-0 h-[9rem] w-[56%] text-[var(--app-accent)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_35%,transparent_92%)]"
    >
      <path d="M74,120 C122,78 176,66 228,52 C270,41 298,26 320,6 L320,120 Z" fill="currentColor" opacity="0.055" />
      <path d="M126,120 C168,86 212,74 258,62 C292,53 308,40 320,24 L320,120 Z" fill="currentColor" opacity="0.055" />
      <path d="M178,120 C212,94 248,84 284,74 C304,68 314,58 320,46 L320,120 Z" fill="currentColor" opacity="0.055" />
      <path d="M228,120 C252,102 278,94 300,86 C312,82 317,74 320,66 L320,120 Z" fill="currentColor" opacity="0.055" />
    </svg>
  );
}

/**
 * One application, as it stands right now.
 *
 * The card answers two questions before you open anything: what is this, and
 * does it need me. So the top is identity and the bottom is the application's
 * own figures, read live from its own data every time this page renders.
 *
 * An application that is not built gets the same card and no numbers. Filling
 * it with plausible-looking figures would turn the launcher into a mock-up of
 * itself, and the first real number to appear would not be believed.
 */
export function AppCard({
  app,
  snapshot,
  delay,
}: {
  app: SquirlApp;
  snapshot: AppSnapshot | null;
  delay: number;
}) {
  // Pulled out so the narrowing below holds. Reading app.href twice leaves
  // TypeScript unable to prove it is still defined at the Link.
  const href = app.href;
  const open = app.status === 'ready' && Boolean(href);

  const body = (
    <>
      <Contours />

      <div className="relative flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent-wash)]">
          <AppMark name={app.mark} size={30} />
        </span>

        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[1.25rem] font-semibold leading-tight tracking-[-0.015em] text-ink">
              {app.name}
            </span>
            {open ? null : (
              <span className="rounded-full border border-line px-2 py-0.5 text-[0.6875rem] font-medium text-ink-3">
                Next
              </span>
            )}
          </span>
          <span className="mt-1 block text-[0.8125rem] leading-relaxed text-ink-3">{app.tagline}</span>
        </span>

        {open ? (
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-[background-color,border-color,color,transform] duration-[var(--t-move)] group-hover:translate-x-0.5 group-hover:border-transparent group-hover:bg-ink group-hover:text-ink-invert"
          >
            <ArrowRight size={15} weight="bold" />
          </span>
        ) : null}
      </div>

      {snapshot ? (
        <>
          <dl className="relative mt-6 grid grid-cols-3 divide-x divide-line border-t border-line pt-4">
            {snapshot.stats.map((stat, index) => (
              <div key={stat.label} className={cn('min-w-0', index === 0 ? 'pr-4' : 'px-4')}>
                <dt className="truncate text-[0.75rem] text-ink-3">{stat.label}</dt>
                <dd
                  className={cn(
                    'money mt-1.5 truncate text-[1.25rem] leading-none',
                    index === 0 && snapshot.tone === 'attention'
                      ? 'text-[var(--i-owe-text)]'
                      : 'text-ink',
                  )}
                >
                  {stat.value}
                </dd>
                {stat.note ? (
                  <dd className="mt-1.5 truncate text-[0.75rem] text-ink-3">{stat.note}</dd>
                ) : null}
              </div>
            ))}
          </dl>

          {snapshot.trend && snapshot.trend.length > 1 ? (
            <div className="relative mt-auto flex items-end gap-5 border-t border-line pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-[0.75rem] text-ink-3">{snapshot.trendLabel}</p>
                <div className="mt-2.5 h-11">
                  <Spark values={snapshot.trend} />
                </div>
              </div>
              {snapshot.trendValue ? (
                <p className="money shrink-0 pb-1 text-[1rem] text-ink-2">{snapshot.trendValue}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="relative mt-6 flex flex-1 flex-col justify-center border-t border-line pt-6">
          <p className="text-[0.9375rem] font-medium text-ink">Not built yet</p>
          <p className="mt-2 max-w-[26rem] text-[0.8125rem] leading-relaxed text-ink-3">{app.note}</p>
        </div>
      )}
    </>
  );

  const shell = cn(
    'rise group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface p-5',
    app.accentClass,
  );

  if (!open || !href) {
    return (
      <section className={shell} style={{ animationDelay: `${delay}ms` }}>
        {body}
      </section>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        shell,
        'transition-[transform,border-color,box-shadow] duration-[var(--t-move)] ease-[var(--ease)]',
        'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_14px_36px_-18px_oklch(0.22_0.012_265/0.24)]',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {body}
    </Link>
  );
}
