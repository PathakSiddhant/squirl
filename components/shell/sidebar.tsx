'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';

import { LedgerMark, Mark } from '@/components/brand/logo';
import { cn } from '@/lib/cn';

import { Icon } from './icon';
import { NAV_ITEMS, NAV_SECTIONS } from './nav-items';
import { ThemeToggle } from './theme-toggle';

/**
 * The deepest nav item the current path falls under.
 *
 * A plain startsWith cannot do this any more. Ledger's own home is /ledger and
 * every other screen is nested below it, so prefix matching alone would light
 * up Today on every page in the application. Taking the longest match instead
 * means a route belongs to exactly one nav item, whatever the tree looks like.
 */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of NAV_ITEMS) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (best === null || item.href.length > best.length)) best = item.href;
  }
  return best;
}

/** The desktop rail. Hidden below lg, where the tab bar takes over. */
export function Sidebar() {
  const pathname = usePathname();
  const current = activeHref(pathname);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[228px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      {/* Squirl is the way out, not the identity of this screen. It stays
          small and quiet above the application you are actually in. */}
      <Link
        href="/"
        className="mx-2 mt-3 flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[0.75rem] text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink-2"
      >
        <CaretLeft size={11} weight="bold" />
        <Mark size={15} />
        Squirl
      </Link>

      <div className="flex items-center gap-2.5 px-4 pb-4 pt-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--app-accent-wash)]">
          <LedgerMark size={21} />
        </span>
        <span className="min-w-0">
          <span className="block text-[0.9375rem] font-semibold leading-tight text-ink">Ledger</span>
          <span className="block text-[0.6875rem] text-ink-3">Know where you stand</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Main">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading} className="mb-3">
            <p className="px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-3">
              {section.heading}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = current === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      title={item.blurb}
                      className={cn(
                        'flex items-center gap-2.5 rounded-sm px-2.5 py-[7px] text-[0.875rem]',
                        'transition-colors duration-[var(--t-state)]',
                        active
                          ? 'bg-[var(--app-accent-wash)] font-medium text-ink'
                          : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                      )}
                    >
                      <Icon
                        name={item.icon}
                        size={16}
                        weight={active ? 'fill' : 'regular'}
                        className={active ? 'text-[var(--app-accent)]' : undefined}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-3">
        <ThemeToggle />
        <kbd className="rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-3">
          Ctrl K
        </kbd>
      </div>
    </aside>
  );
}

/** The mobile tab bar, pinned to the bottom and clear of the home indicator. */
export function TabBar() {
  const pathname = usePathname();
  const current = activeHref(pathname);
  const items = NAV_ITEMS.filter((i) => i.primary);

  return (
    <nav
      aria-label="Main"
      className="z-sticky fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = current === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium',
                  active ? 'text-ink' : 'text-ink-3',
                )}
              >
                <Icon
                  name={item.icon}
                  size={19}
                  weight={active ? 'fill' : 'regular'}
                  className={active ? 'text-[var(--app-accent)]' : undefined}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/ledger/guide"
            aria-current={pathname.startsWith('/ledger/guide') ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium',
              pathname.startsWith('/ledger/guide') ? 'text-ink' : 'text-ink-3',
            )}
          >
            <Icon name="Question" size={19} weight={pathname.startsWith('/ledger/guide') ? 'fill' : 'regular'} />
            Help
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/**
 * The mobile header, since the rail is hidden at that width.
 *
 * It has to do the rail's two jobs at once: say which application you are in,
 * and give you the way back out to Squirl.
 */
export function MobileHeader() {
  return (
    <header className="z-sticky sticky top-0 flex items-center justify-between border-b border-line bg-bg/95 px-4 py-2 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          aria-label="Back to Squirl"
          className="-ml-1 flex items-center gap-0.5 rounded-sm py-1 pl-1 pr-1.5 text-ink-3 transition-colors duration-[var(--t-state)] active:bg-surface-2"
        >
          <CaretLeft size={12} weight="bold" />
          <Mark size={17} />
        </Link>
        <span className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-sm bg-[var(--app-accent-wash)]">
            <LedgerMark size={16} />
          </span>
          <span className="text-[0.9375rem] font-semibold text-ink">Ledger</span>
        </span>
      </div>
      <ThemeToggle />
    </header>
  );
}
