'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

import { SyncButton } from './sync-button';

/**
 * Three places, and the sync control.
 *
 * Three because that is genuinely how many there are: what is waiting, who it
 * comes from, and what you have chosen to follow. A fourth would be invented
 * to fill the bar.
 */
const PLACES = [
  { href: '/signal', label: 'Inbox' },
  { href: '/signal/channels', label: 'Channels' },
] as const;

export function SignalNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex min-w-0 flex-1 items-center gap-1">
        {PLACES.map((place) => {
          // Exact match for the inbox, prefix for the rest, or the inbox would
          // stay lit on every screen inside Signal.
          const active =
            place.href === '/signal' ? pathname === '/signal' : pathname.startsWith(place.href);

          return (
            <Link
              key={place.href}
              href={place.href}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[0.8125rem] transition-colors duration-[var(--t-state)]',
                active ? 'bg-surface-2 font-medium text-ink' : 'text-ink-3 hover:text-ink-2',
              )}
            >
              {place.label}
            </Link>
          );
        })}
      </nav>

      <SyncButton />
    </>
  );
}
