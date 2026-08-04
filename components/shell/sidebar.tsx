'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Lockup, Mark } from '@/components/brand/logo';
import { cn } from '@/lib/cn';

import { Icon } from './icon';
import { NAV_ITEMS, NAV_SECTIONS } from './nav-items';
import { ThemeToggle } from './theme-toggle';

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/** The desktop rail. Hidden below lg, where the tab bar takes over. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[228px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <Link
        href="/"
        aria-label="Squirl, home"
        className="flex flex-col items-start gap-1 px-4 pb-3 pt-5"
      >
        <Lockup size={62} />
        <span className="pl-0.5 text-[0.6875rem] text-ink-3">Know where you stand</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Main">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading} className="mb-3">
            <p className="px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-3">
              {section.heading}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
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
                          ? 'bg-surface-2 font-medium text-ink'
                          : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                      )}
                    >
                      <Icon name={item.icon} size={16} weight={active ? 'fill' : 'regular'} />
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
  const items = NAV_ITEMS.filter((i) => i.primary);

  return (
    <nav
      aria-label="Main"
      className="z-sticky fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
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
                <Icon name={item.icon} size={19} weight={active ? 'fill' : 'regular'} />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/guide"
            aria-current={pathname.startsWith('/guide') ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium',
              pathname.startsWith('/guide') ? 'text-ink' : 'text-ink-3',
            )}
          >
            <Icon name="Question" size={19} weight={pathname.startsWith('/guide') ? 'fill' : 'regular'} />
            Help
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/** The mobile header, since the rail is hidden at that width. */
export function MobileHeader() {
  return (
    <header className="z-sticky sticky top-0 flex items-center justify-between border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur lg:hidden">
      <Link href="/" aria-label="Squirl, home" className="flex items-center gap-2">
        <Mark size={30} />
      </Link>
      <ThemeToggle />
    </header>
  );
}
