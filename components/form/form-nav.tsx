'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

/**
 * Form's navigation, cut into the plaque.
 *
 * ## Two rejected versions, and what was wrong with each
 *
 * First it was five words with a red line sliding underneath. An underline is
 * what every framework ships on day one; it also drew a hard rule across the
 * screen, which is the single most template-looking thing an interface can do.
 *
 * Then it was a floating dock at the bottom with a red capsule around the
 * current stop. That is the other default — the frosted-pill dock is on half
 * the products shipped since 2023 — and it pushed navigation to the far end of
 * a page you then had to scroll.
 *
 * A third version pressed the current section into the plaque as a recess, and
 * that was worse again: soft inner shadows are their own dated house style, and
 * an application built out of them looks like putty.
 *
 * ## What this is instead
 *
 * Ink on paper. The open section is a solid block of the darkest ink in the
 * palette with the name knocked out of it in white, offset by a hard shadow
 * with no blur — the way a second pass of a press sits fractionally off the
 * first. There is no gradient, no glow and no translucency anywhere in it.
 *
 * The block slides between sections as one object, so moving is a physical
 * thing travelling along the plaque rather than a colour blinking across a row.
 */
const STOPS: Array<{ href: Route; label: string }> = [
  { href: '/form' as Route, label: 'Today' },
  { href: '/form/progress' as Route, label: 'Progress' },
  { href: '/form/food' as Route, label: 'Food' },
  { href: '/form/phases' as Route, label: 'Phases' },
  { href: '/form/notes' as Route, label: 'Notes' },
];

export function FormNav() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const isActive = (href: string) =>
    href === '/form' ? pathname === '/form' : pathname.startsWith(href);

  return (
    <nav aria-label="Form" className="min-w-0">
      <ul className="flex items-center gap-0.5 overflow-x-auto">
        {STOPS.map((stop) => {
          const href = stop.href as string;
          const active = isActive(href);

          return (
            <li key={href} className="relative shrink-0">
              <Link
                href={stop.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-9 items-center rounded-full px-3.5',
                  'transition-[color] duration-[var(--t-state)] ease-[var(--ease)]',
                  active
                    ? 'font-serif text-[1.0625rem] tracking-[-0.02em] text-ink-invert'
                    : 'text-[0.9375rem] text-ink-3 hover:text-ink',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]',
                )}
              >
                {/* The block. One element for the whole nav, moved by layout. */}
                {active ? (
                  <motion.span
                    layoutId="form-slot"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 460, damping: 38 }
                    }
                    className="absolute inset-0 rounded-[0.75rem] bg-ink"
                    aria-hidden="true"
                  />
                ) : null}

                <span className="relative whitespace-nowrap">{stop.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
