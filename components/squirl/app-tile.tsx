'use client';

import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { DotsSixVertical } from '@phosphor-icons/react/dist/csr/DotsSixVertical';
import { Reorder, useDragControls } from 'motion/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRef } from 'react';

import { AppMark } from '@/components/brand/logo';
import { cn } from '@/lib/cn';
import type { AppSnapshot } from '@/lib/squirl/apps';

import { CountUp } from './count-up';
import type { LauncherApp } from './launcher-app';
import { Spark } from './spark';
import { TileMenu } from './tile-menu';

/**
 * Contour bands in the application's own accent, bled off the top right.
 *
 * The one piece of ornament on the tile. It is here because a tile that is
 * nothing but a name and a figure reads as a spreadsheet row, and because it
 * is the largest surface where an application's colour can be felt without
 * colouring any of its data. Masked towards its foot, so the bands fade out
 * rather than stopping on a hard horizontal edge through the middle.
 */
function Contours() {
  return (
    <svg
      viewBox="0 0 320 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-0 h-[8rem] w-[62%] text-[var(--app-accent)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_35%,transparent_92%)]"
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
 * Every application gets the same tile, at the same size, whether it is built
 * or not. An earlier version let the grid decide: two built applications
 * filled a row and the third wrapped onto its own line, where it stretched to
 * a different height than its neighbours and read as a mistake rather than as
 * a third application.
 *
 * What differs between a built application and a planned one is what the tile
 * has to say, not how big it is. A built one reports the single figure worth
 * knowing before you open it. A planned one says plainly that it is not built,
 * and its note sits at the foot of the tile rather than floating in the middle
 * of the empty space where numbers would be.
 */
export function AppTile({
  app,
  snapshot,
  delay,
  index,
  focused,
  onFocus,
  carried,
  onCarry,
  onFirst,
  onReset,
}: {
  app: LauncherApp;
  snapshot: AppSnapshot | null;
  delay: number;
  index: number;
  focused: string | null;
  onFocus: (id: string | null) => void;
  carried: string | null;
  onCarry: (id: string | null) => void;
  onFirst: (id: string) => void;
  onReset: () => void;
}) {
  const surface = useRef<HTMLElement>(null);
  const controls = useDragControls();
  const router = useRouter();

  // Written as custom properties rather than through state: this fires on
  // every pointer move, and a re-render per frame would cost more than the
  // effect is worth.
  const track = (event: React.PointerEvent<HTMLElement>) => {
    const node = surface.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    node.style.setProperty('--mx', `${x}px`);
    node.style.setProperty('--my', `${y}px`);

    // Held to three degrees. Past about four this stops reading as a surface
    // tipping under a finger and starts reading as a card doing a trick.
    node.style.setProperty('--tilt-y', `${((x / box.width) * 2 - 1) * 3}deg`);
    node.style.setProperty('--tilt-x', `${((y / box.height) * 2 - 1) * -3}deg`);
  };

  const release = () => {
    const node = surface.current;
    if (!node) return;
    node.style.setProperty('--tilt-x', '0deg');
    node.style.setProperty('--tilt-y', '0deg');
  };

  const href = app.href;
  const open = app.status === 'ready' && Boolean(href);
  const [headline, ...rest] = snapshot?.stats ?? [];

  const body = (
    <>
      <Contours />

      {/* A soft light that follows the pointer across the tile, in the
          application's own accent. It is the one thing on this screen that
          responds continuously rather than in steps, and it is what makes a
          flat rectangle feel like a surface you are touching. Driven by two
          CSS variables written straight onto the node, so tracking the cursor
          never re-renders React. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--t-move)] group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(18rem circle at var(--mx,50%) var(--my,50%), var(--app-accent), transparent 70%)',
          mixBlendMode: 'soft-light',
        }}
      />

      {/* Picked up by the grip alone. The tile is a link, and a tile you can
          start dragging from anywhere is a link you cannot reliably click. */}
      <span
        onPointerDown={(event) => {
          // Hands the gesture to the reorder group, which then moves this tile
          // under the pointer and animates the others out of its way as it
          // goes. The browser's own drag-and-drop did none of that: it showed a
          // translucent screenshot of the tile and rearranged nothing until the
          // drop, so there was no way to see what the drop was going to do.
          event.preventDefault();
          controls.start(event);
          onCarry(app.id);
        }}
        onClick={(event) => event.preventDefault()}
        title="Drag to reorder"
        className={cn(
          'absolute right-2 top-2 z-10 flex size-6 cursor-grab items-center justify-center rounded-md',
          'text-ink-3 opacity-0 transition-opacity duration-[var(--t-hover)]',
          'hover:bg-surface-2 hover:text-ink-2 active:cursor-grabbing group-hover:opacity-100',
        )}
      >
        <DotsSixVertical size={13} weight="bold" />
      </span>

      {/* The key that opens it. Shown only under the pointer, because it is a
          shortcut worth discovering rather than a label worth wearing. */}
      {open ? (
        <span
          aria-hidden="true"
          className="absolute left-2 top-2 z-10 rounded-md border border-line bg-surface px-1.5 text-[0.625rem] font-medium text-ink-3 opacity-0 transition-opacity duration-[var(--t-hover)] group-hover:opacity-100"
        >
          {index + 1}
        </span>
      ) : null}

      <div className="relative flex items-start justify-between gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent-wash)]">
          <AppMark name={app.mark} size={26} />
        </span>

        {open ? (
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-[background-color,border-color,color,transform] duration-[var(--t-move)] group-hover:translate-x-0.5 group-hover:border-transparent group-hover:bg-ink group-hover:text-ink-invert"
          >
            <ArrowRight size={14} weight="bold" />
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[0.6875rem] font-medium text-ink-3">
            Next
          </span>
        )}
      </div>

      <h2 className="relative mt-3 text-[1.1875rem] font-semibold leading-tight tracking-[-0.015em] text-ink">
        {app.name}
      </h2>
      <p className="relative mt-1 line-clamp-1 text-[0.8125rem] leading-relaxed text-ink-3">
        {app.tagline}
      </p>

      {headline ? (
        <div className="relative mt-3 border-t border-line pt-2.5">
          <p className="text-[0.75rem] text-ink-3">{headline.label}</p>
          <CountUp
            value={headline.value}
            className={cn(
              'money mt-1 block truncate text-[1.25rem] leading-none',
              snapshot?.tone === 'attention' ? 'text-[var(--i-owe-text)]' : 'text-ink',
            )}
          />
          {headline.note ? (
            <p className="mt-1.5 truncate text-[0.75rem] text-ink-3">{headline.note}</p>
          ) : null}

          {rest.length ? (
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {rest.map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <dt className="truncate text-[0.6875rem] text-ink-3">{stat.label}</dt>
                  <dd className="money mt-0.5 truncate text-[0.875rem] text-ink">{stat.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {snapshot?.trend && snapshot.trend.length > 1 ? (
            <div className="mt-2.5 flex items-end gap-3 border-t border-line pt-2 [@media(max-height:820px)]:hidden">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.6875rem] text-ink-3">{snapshot.trendLabel}</p>
                <div className="mt-1.5 h-6">
                  <Spark values={snapshot.trend} />
                </div>
              </div>
              {snapshot.trendValue ? (
                <p className="money shrink-0 text-[0.8125rem] text-ink-2">{snapshot.trendValue}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        /* Top-aligned, directly under the tagline, with the empty space left
           at the foot. Pushing it to the bottom instead opened a hole through
           the middle of the tile, which read as something that failed to load
           rather than as an application with nothing to report yet. */
        <div className="relative mt-3 border-t border-line pt-2.5">
          <p className="text-[0.8125rem] font-medium text-ink">
            {open ? 'Figures unavailable' : 'Not built yet'}
          </p>
          <p className="mt-1.5 line-clamp-3 text-[0.75rem] leading-relaxed text-ink-3">
            {open
              ? `${app.name} is installed and nothing has been changed. Its numbers could not be read just now, so none are shown rather than shown wrong.`
              : app.note}
          </p>
        </div>
      )}
    </>
  );

  // Dimmed only while some other application is the subject. Nothing is
  // dimmed when nothing is pointed at, so the resting page is never faded.
  const muted = focused !== null && focused !== app.id;
  const lifted = carried === app.id;

  const shell = cn(
    'rise group relative flex h-full min-h-[10.5rem] flex-col overflow-hidden rounded-2xl border bg-surface p-4',
    'transition-[opacity,border-color] duration-[var(--t-hover)]',
    focused === app.id ? 'border-[var(--app-accent)]' : 'border-line',
    muted && 'opacity-55',
    lifted && 'opacity-40',
    carried && !lifted && 'ring-1 ring-[var(--app-accent)]/30',
    app.accentClass,
  );

  const wrap = (inner: React.ReactNode) => (
    <Reorder.Item
      value={app.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={() => onCarry(null)}
      className="min-w-0 flex-1"
      // Lifted clear of its neighbours while it travels, and settled back on a
      // spring rather than a curve, because the thing being moved is a card
      // being picked up rather than a value being tweened.
      whileDrag={{ scale: 1.03, zIndex: 30 }}
      transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }}
    >
      <TileMenu
        name={app.name}
        canOpen={open}
        onOpen={() => href && router.push(href)}
        onFirst={() => onFirst(app.id)}
        onReset={onReset}
      >
        {inner}
      </TileMenu>
    </Reorder.Item>
  );

  if (!open || !href) {
    return wrap(
      <section
        data-app={app.id}
        ref={surface}
        onPointerEnter={() => onFocus(app.id)}
        onPointerMove={track}
        onPointerLeave={() => {
          onFocus(null);
          release();
        }}
        className={shell}
        style={{ animationDelay: `${delay}ms` }}
      >
        {body}
      </section>,
    );
  }

  return wrap(
    <Link
      href={href}
      data-app={app.id}
      ref={surface as React.Ref<HTMLAnchorElement>}
      onPointerEnter={() => onFocus(app.id)}
      onPointerMove={track}
      onPointerLeave={() => {
        onFocus(null);
        release();
      }}
      className={cn(
        shell,
        'tile-lift',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {body}
    </Link>,
  );
}
