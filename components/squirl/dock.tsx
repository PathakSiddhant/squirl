'use client';

import { DotsSixVertical } from '@phosphor-icons/react/dist/csr/DotsSixVertical';
import { Desktop } from '@phosphor-icons/react/dist/csr/Desktop';
import { Info } from '@phosphor-icons/react/dist/csr/Info';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { Moon } from '@phosphor-icons/react/dist/csr/Moon';
import { Rows } from '@phosphor-icons/react/dist/csr/Rows';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { Sun } from '@phosphor-icons/react/dist/csr/Sun';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

type Theme = 'light' | 'dark' | 'system';
export type DockEdge = 'top' | 'bottom' | 'left' | 'right';

const STORED_EDGE = 'squirl-dock-edge';

function paint(choice: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = choice === 'dark' || (choice === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = choice;
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

/** Which wall a point is nearest, in fractions of the window. */
function nearestEdge(x: number, y: number): DockEdge {
  const left = x / window.innerWidth;
  const right = 1 - left;
  const top = y / window.innerHeight;
  const bottom = 1 - top;
  const min = Math.min(left, right, top, bottom);
  if (min === top) return 'top';
  if (min === bottom) return 'bottom';
  if (min === left) return 'left';
  return 'right';
}

/**
 * The dock. It belongs to a wall, and you choose which one.
 *
 * Taken off the page's flow entirely and given to the window instead, because
 * a bar in the layout costs the layout its height whether or not you are using
 * it. Fixed, it hovers over the corner of the screen it was put in and the
 * launcher underneath keeps its full height.
 *
 * Dragging it does not leave it wherever it was dropped. It goes to the
 * nearest wall and centres itself there, the way a taskbar does, because a
 * control bar floating at an arbitrary angle in the middle of a window is a
 * thing to tidy up rather than a thing to use. Left and right turn it upright,
 * which is the shape those walls have room for.
 *
 * Ctrl-\ takes it away and brings it back. That pair is unbound in browsers
 * and in the usual desktop shells, so the shortcut costs nothing that was
 * already spoken for.
 */

/**
 * One control on the dock.
 *
 * Defined at module scope rather than inside `Dock`. Declared inside, it would
 * be a brand new component type on every render, so the first hover, which
 * sets state, would unmount and remount every button on the bar mid-gesture.
 * A pointer that went down on one element and up on its replacement produces
 * no click at all, which made the dock's buttons intermittently dead.
 */
function DockItem({
  id,
  label,
  onClick,
  active,
  children,
  edge,
  hovered,
  onHover,
}: {
  id: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  edge: DockEdge;
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  const side = edge === 'bottom' ? 'top' : edge === 'top' ? 'bottom' : edge === 'left' ? 'right' : 'left';

  return (
    <Tooltip.Root open={hovered === id} onOpenChange={(next) => onHover(next ? id : null)}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            'dock-item relative flex size-9 items-center justify-center rounded-xl',
            active ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink',
          )}
        >
          {children}
        </button>
      </Tooltip.Trigger>

      <Tooltip.Portal>
        {/* Leaves from whichever side has the room, so a wall-mounted dock
            never throws its labels out over the wall. Radix keeps them the
            right way up and out of the window's edges without any of that
            being arithmetic here. */}
        <Tooltip.Content
          side={side}
          sideOffset={10}
          collisionPadding={10}
          className={cn(
            'z-[62] rounded-md border border-line bg-surface px-2 py-1',
            'text-[0.625rem] font-medium text-ink-2 shadow-[var(--shadow-pop)]',
            'data-[state=delayed-open]:animate-[sheet-in_140ms_var(--ease)]',
          )}
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Dock({
  view,
  onChooseView,
  onOpenStorage,
  onLock,
  theme,
  onChooseTheme,
}: {
  view: string;
  onChooseView: (next: 'cards' | 'icons') => void;
  onOpenStorage: () => void;
  onLock: () => void;
  theme: Theme;
  onChooseTheme: (next: Theme) => void;
}) {
  const [edge, setEdge] = useState<DockEdge>('bottom');
  const [hidden, setHidden] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<DockEdge | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORED_EDGE) as DockEdge | null;
    if (stored && ['top', 'bottom', 'left', 'right'].includes(stored)) setEdge(stored);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
        event.preventDefault();
        setHidden((was) => !was);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Dragging is tracked on the window rather than on the bar, so the pointer
  // is allowed to outrun it without the gesture being dropped.
  useEffect(() => {
    if (!drag) return;

    const move = (event: PointerEvent) => {
      setDrag({ x: event.clientX, y: event.clientY });
      setTarget(nearestEdge(event.clientX, event.clientY));
    };

    const up = (event: PointerEvent) => {
      const landed = nearestEdge(event.clientX, event.clientY);
      setEdge(landed);
      localStorage.setItem(STORED_EDGE, landed);
      setDrag(null);
      setTarget(null);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag]);

  /*
    Magnification.

    The icons swell as the pointer approaches and settle as it leaves, on a
    smooth falloff rather than a hit test, so the whole bar breathes around
    wherever you are rather than one icon popping when you happen to cross it.
    This is the oldest good idea in docks and it is still the most satisfying
    one, and it earns its place here beyond the pleasure: at nine icons in a
    row the thing under the cursor is genuinely easier to be sure of.

    Written straight to transforms on pointermove. There are nine nodes and the
    browser already throttles the event to the frame, so a rAF loop and a React
    render per frame would both be more machinery than this needs.
  */
  const magnify = (event: React.PointerEvent) => {
    const host = bar.current;
    if (!host || drag) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    host.dataset.mag = 'on';
    const along = upright ? event.clientY : event.clientX;

    for (const node of host.querySelectorAll<HTMLElement>('.dock-item')) {
      const box = node.getBoundingClientRect();
      const centre = upright ? box.top + box.height / 2 : box.left + box.width / 2;
      // Squared falloff: near the pointer the change is gentle, and it reaches
      // zero smoothly instead of stopping at the edge of its reach.
      const pull = Math.max(0, 1 - Math.abs(along - centre) / 96);
      const eased = pull * pull;
      const lift = upright ? `translateX(${eased * 5}px)` : `translateY(${eased * -7}px)`;
      node.style.transform = `${lift} scale(${1 + eased * 0.42})`;
    }
  };

  const settle = () => {
    const host = bar.current;
    if (!host) return;
    delete host.dataset.mag;
    for (const node of host.querySelectorAll<HTMLElement>('.dock-item')) {
      node.style.transform = '';
    }
  };

  const upright = edge === 'left' || edge === 'right';

  const anchor: Record<DockEdge, string> = {
    bottom: 'bottom-4 left-1/2 -translate-x-1/2',
    top: 'top-4 left-1/2 -translate-x-1/2',
    left: 'left-4 top-1/2 -translate-y-1/2',
    right: 'right-4 top-1/2 -translate-y-1/2',
  };

  const rule = (
    <span
      className={cn('bg-line', upright ? 'my-1 h-px w-5' : 'mx-1 h-5 w-px')}
      aria-hidden="true"
    />
  );

  return (
    <Tooltip.Provider delayDuration={260} skipDelayDuration={400}>
      {/* While the bar is in the air, the wall it would land on is lit. Without
          it the drop is a guess. */}
      {drag && target ? (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none fixed z-[60] bg-[var(--cta)]/25',
            target === 'top' && 'inset-x-0 top-0 h-16',
            target === 'bottom' && 'inset-x-0 bottom-0 h-16',
            target === 'left' && 'inset-y-0 left-0 w-16',
            target === 'right' && 'inset-y-0 right-0 w-16',
          )}
          style={{ transition: 'opacity 160ms var(--ease)' }}
        />
      ) : null}

      <div
        ref={bar}
        data-edge={edge}
        onPointerMove={magnify}
        onPointerLeave={settle}
        className={cn(
          'dock-shell fixed z-[61] flex items-center gap-0.5 rounded-2xl border border-line',
          'bg-surface/90 p-1.5 shadow-[var(--shadow-pop)] backdrop-blur-md',
          upright ? 'flex-col' : 'flex-row',
          drag ? 'pointer-events-none' : anchor[edge],
          hidden && 'dock-gone',
        )}
        style={
          drag
            ? {
                left: drag.x,
                top: drag.y,
                transform: 'translate(-50%, -50%) scale(0.94)',
                opacity: 0.9,
              }
            : undefined
        }
      >
        {/* The handle. Dragging anywhere else would mean every button was also
            a place you could accidentally pick the whole bar up from. */}
        <span
          onPointerDown={(event) => {
            event.preventDefault();
            setDrag({ x: event.clientX, y: event.clientY });
            setTarget(nearestEdge(event.clientX, event.clientY));
          }}
          title="Drag to another edge"
          className={cn(
            'flex cursor-grab items-center justify-center rounded-lg text-ink-3',
            'transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink-2 active:cursor-grabbing',
            upright ? 'h-5 w-9' : 'h-9 w-5',
          )}
        >
          <DotsSixVertical size={14} weight="bold" className={upright ? 'rotate-90' : undefined} />
        </span>

        <DockItem edge={edge} hovered={hovered} onHover={setHovered} id="info" label="Where your data lives" onClick={onOpenStorage}>
          <Info size={16} />
        </DockItem>

        {rule}

        <DockItem edge={edge} hovered={hovered} onHover={setHovered} id="cards" label="Cards" active={view === 'cards'} onClick={() => onChooseView('cards')}>
          <Rows size={15} weight={view === 'cards' ? 'fill' : 'regular'} />
        </DockItem>
        <DockItem edge={edge} hovered={hovered} onHover={setHovered} id="icons" label="Icons" active={view === 'icons'} onClick={() => onChooseView('icons')}>
          <SquaresFour size={15} weight={view === 'icons' ? 'fill' : 'regular'} />
        </DockItem>

        {rule}

        <DockItem
          edge={edge}
          hovered={hovered}
          onHover={setHovered}
          id="light"
          label="Light"
          active={theme === 'light'}
          onClick={() => {
            onChooseTheme('light');
            paint('light');
          }}
        >
          <Sun size={15} weight={theme === 'light' ? 'fill' : 'regular'} />
        </DockItem>
        <DockItem
          edge={edge}
          hovered={hovered}
          onHover={setHovered}
          id="system"
          label="System"
          active={theme === 'system'}
          onClick={() => {
            onChooseTheme('system');
            paint('system');
          }}
        >
          <Desktop size={15} weight={theme === 'system' ? 'fill' : 'regular'} />
        </DockItem>
        <DockItem
          edge={edge}
          hovered={hovered}
          onHover={setHovered}
          id="dark"
          label="Dark"
          active={theme === 'dark'}
          onClick={() => {
            onChooseTheme('dark');
            paint('dark');
          }}
        >
          <Moon size={15} weight={theme === 'dark' ? 'fill' : 'regular'} />
        </DockItem>

        {rule}

        <DockItem edge={edge} hovered={hovered} onHover={setHovered} id="lock" label="Lock Squirl" onClick={onLock}>
          <Lock size={16} />
        </DockItem>
      </div>
    </Tooltip.Provider>
  );
}
