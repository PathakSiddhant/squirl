'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

import { Icon } from './icon';
import { NAV_ITEMS } from './nav-items';
import { ThemeToggle } from './theme-toggle';

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/** The desktop rail. Hidden below lg, where the tab bar takes over. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[216px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="px-4 py-5">
        <Link href="/" className="inline-flex flex-col leading-none">
          <span className="text-[1.25rem] font-semibold tracking-tight text-ink">हिसाब</span>
          <span className="mt-1 text-[0.6875rem] font-medium tracking-[0.14em] text-ink-3">HISAAB</span>
        </Link>
      </div>

      <nav className="flex-1 px-2" aria-label="Main">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
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
      <ul className="grid grid-cols-4">
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
      </ul>
    </nav>
  );
}

/** The mobile header, since the rail is hidden at that width. */
export function MobileHeader() {
  return (
    <header className="z-sticky sticky top-0 flex items-center justify-between border-b border-line bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
      <Link href="/" className="text-[1.0625rem] font-semibold tracking-tight text-ink">
        हिसाब
      </Link>
      <ThemeToggle />
    </header>
  );
}
