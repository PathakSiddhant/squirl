'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

/**
 * Where you can stand inside Signal.
 *
 * Two places, because that is genuinely how many there are: what is waiting,
 * and what you have chosen to follow. A third would be invented to fill the
 * bar, and this bar is not short of things to hold.
 *
 * The sync control is a sibling in the shell rather than a member of this
 * component: the two sit on opposite sides of a centred mark, and a nav that
 * insisted on drawing both would be deciding that layout for the shell.
 */
const PLACES = [
  { href: '/signal', label: 'Inbox' },
  { href: '/signal/channels', label: 'Channels' },
] as const;

export function SignalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex min-w-0 items-center gap-0.5">
      {PLACES.map((place) => {
        // Exact for the inbox, prefix for everything nested. Otherwise the
        // inbox stays lit on every screen in the application.
        const active =
          place.href === '/signal' ? pathname === '/signal' : pathname.startsWith(place.href);

        return (
          <Link
            key={place.href}
            href={place.href}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[0.9375rem] transition-colors duration-[var(--t-state)]',
              active ? 'bg-surface-2 font-medium text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {place.label}
          </Link>
        );
      })}
    </nav>
  );
}
