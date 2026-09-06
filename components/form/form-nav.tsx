'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * Form's navigation, cut into the plaque.
 *
 * ## Three rejected versions
 *
 * First, five words with a red line sliding underneath. An underline is what
 * every framework ships on day one, and it drew a hard rule across the top of
 * the screen — the single most template-looking thing an interface can do.
 *
 * Then a floating dock at the bottom with a red capsule around the current
 * stop. That is the other default, it is on half the products shipped since
 * 2023, and it pushed navigation to the far end of a page you then scrolled.
 *
 * Then the current section pressed into the plaque as a recess. Soft inner
 * shadows are their own dated house style; an application built out of them
 * looks like putty.
 *
 * ## What this is
 *
 * Ink on paper. The open section is a solid block of the darkest ink in the
 * palette with its name knocked out of it in white. No gradient, no glow, no
 * translucency. It slides between sections, so moving is one object travelling
 * along the plaque rather than a colour blinking across a row.
 *
 * ## Why the block is measured rather than projected
 *
 * It used to be a `motion.span` with a `layoutId` inside each link, which is
 * the idiomatic way to write this and was quietly broken. `layoutId` crossfades
 * by default: the arriving element starts transparent and the departing one
 * fades out. A route change swaps them in the same commit with no
 * `AnimatePresence` keeping the old one alive, so the crossfade had something
 * to fade *from* and nothing to fade *to* — the new block settled at opacity
 * zero and stayed there. It was the right size, in the right place, in the
 * right colour, and invisible, while the label above it was already the
 * knocked-out white that only works on top of it. The open tab vanished after
 * every single click.
 *
 * So there is exactly one block, it lives in the list rather than inside a
 * link, and it never unmounts. Its position and width are measured from the
 * active item and animated as ordinary values. Nothing can crossfade it away.
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

  const list = useRef<HTMLUListElement>(null);
  const items = useRef(new Map<string, HTMLLIElement>());
  const [block, setBlock] = useState<{ x: number; width: number } | null>(null);

  const isActive = (href: string) =>
    href === '/form' ? pathname === '/form' : pathname.startsWith(href);

  const activeHref = STOPS.find((stop) => isActive(stop.href as string))?.href as string | undefined;

  const measure = useCallback(() => {
    if (!activeHref) return;
    const item = items.current.get(activeHref);
    if (!item) return;
    setBlock({ x: item.offsetLeft, width: item.offsetWidth });
  }, [activeHref]);

  // Before paint, so the block is never drawn in the wrong place for a frame.
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    // Web fonts land after first paint and change every label's width.
    void document.fonts?.ready.then(measure);

    const observer = new ResizeObserver(measure);
    const node = list.current;
    if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <nav aria-label="Form" className="min-w-0">
      <ul ref={list} className="relative flex items-center gap-0.5 overflow-x-auto">
        {block ? (
          <motion.span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-[0.75rem] bg-ink"
            initial={false}
            animate={{ x: block.x, width: block.width }}
            transition={
              reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 38 }
            }
          />
        ) : null}

        {STOPS.map((stop) => {
          const href = stop.href as string;
          const active = isActive(href);

          return (
            <li
              key={href}
              ref={(node) => {
                if (node) items.current.set(href, node);
                else items.current.delete(href);
              }}
              className="relative shrink-0"
            >
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
                <span className="whitespace-nowrap">{stop.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
