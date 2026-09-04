'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Mark } from '@/components/brand/logo';
import { cn } from '@/lib/cn';

import type { LauncherApp } from './launcher-app';

/**
 * Squirl, with its applications going round it. In three dimensions, and you
 * can push it.
 *
 * This is the one object on the screen that is not a rectangle, and it is the
 * product's own model drawn literally: the mark is the environment, each body
 * orbiting it is an installed application, and built ones ride the inner ring
 * because those are the ones you reach for.
 *
 * It is genuinely dimensional rather than a flat ring pretending. Each body is
 * placed in a real orbital plane, tilted away from the viewer, then spun about
 * the vertical axis; what you see is that position projected. So a body passes
 * behind the mark and is occluded by it, comes round the front larger and
 * brighter, and the ellipse you read is the perspective rather than a drawn
 * oval.
 *
 * Everything is computed straight to transforms inside one animation frame.
 * There is no state per frame and no React render per frame: sixty renders a
 * second to move four dots would cost more than the whole rest of the page.
 */

/** Degrees the orbital plane is tipped away from face-on. */
const TILT = (61 * Math.PI) / 180;
/** Idle drift. Slow enough to be noticed only if you look for it. */
const DRIFT = 0.0022;
/** How much of its speed the spin keeps each frame after you let go. */
const FRICTION = 0.955;

/**
 * Three rings, drawn whether or not they are all occupied.
 *
 * The object has to survive Squirl growing. Two rings with three applications
 * on them is a picture that has to be redrawn the moment there are five, and a
 * ring that appears out of nowhere reads as a bug. Drawing the system's full
 * shape from the start means new applications arrive into a place that was
 * already there.
 */
const RINGS = [0.24, 0.35, 0.46];

interface Body {
  app: LauncherApp;
  radius: number;
  phase: number;
}

export function Orbit({
  apps,
  size,
  focused,
  onFocus,
}: {
  apps: LauncherApp[];
  size: number;
  focused: string | null;
  onFocus: (id: string | null) => void;
}) {
  /*
    The box is the shape of the orbit, not a square around it.

    A tilted ring is a wide, shallow ellipse: at this angle it is about half as
    tall as it is wide. Reserving a square meant a third of the height of this
    section was empty sky above and below the rings, which is what pushed the
    applications off the bottom of the window. Reserving the ellipse instead
    buys the object real width, which is the dimension it is actually read in.
  */
  const height = Math.round(size * 2 * RINGS[RINGS.length - 1] * Math.cos(TILT)) + 44;
  const router = useRouter();
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const dots = useRef<Array<HTMLButtonElement | null>>([]);
  const [held, setHeld] = useState(false);

  // Spin, velocity, and the pointer's last position. Refs because the loop
  // writes them every frame and nothing about them belongs in a render.
  const spin = useRef(0);
  const velocity = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);

  // Built applications take the inner ring, because those are the ones you
  // reach for. Everything still to come is spread over the outer two rather
  // than crowded onto one, so a body never has to share an orbit until there
  // are genuinely more applications than rings.
  let planned = 0;
  const bodies: Body[] = apps.map((app, index) => {
    const ring = app.status === 'ready' ? 0 : 1 + (planned++ % (RINGS.length - 1));
    return {
      app,
      radius: RINGS[ring] * size,
      // Offset per ring as well as per application, so two bodies on different
      // rings are never caught on the same spoke.
      phase: (index / Math.max(apps.length, 1)) * Math.PI * 2 + ring * 0.9,
    };
  });

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;

    const draw = () => {
      if (!dragging.current) {
        // Coast, then settle back to the idle drift rather than to a stop, so
        // the object never reads as switched off.
        velocity.current *= FRICTION;
        if (Math.abs(velocity.current) < DRIFT) velocity.current = still ? 0 : DRIFT;
        spin.current += velocity.current;
      }

      for (let index = 0; index < bodies.length; index++) {
        const node = dots.current[index];
        if (!node) continue;
        const body = bodies[index];

        const angle = body.phase + spin.current;
        // Position in the orbital plane, then tip the plane towards the viewer.
        const x = Math.cos(angle) * body.radius;
        const z = Math.sin(angle) * body.radius;
        const y = z * Math.cos(TILT);
        const depth = z * Math.sin(TILT);

        // Depth reads as size and as air: further away is smaller and paler,
        // which is what makes a flat circle of dots resolve into an orbit.
        const near = (depth / body.radius + 1) / 2;
        const scale = 0.72 + near * 0.5;

        node.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
        node.style.opacity = String(0.5 + near * 0.5);
        // Behind the mark, or in front of it.
        node.style.zIndex = String(depth < 0 ? 1 : 3);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // Rebuilt when the ring geometry changes, which is what `size` and the app
    // list between them describe.
  }, [size, apps.length]);

  const onPointerDown = (event: React.PointerEvent) => {
    dragging.current = true;
    setHeld(true);
    lastX.current = event.clientX;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = event.clientX - lastX.current;
    lastX.current = event.clientX;
    // Straight to the angle while held, and remembered as speed so letting go
    // hands the object its momentum instead of stopping it dead.
    const step = dx * 0.008;
    spin.current += step;
    velocity.current = step;
  };

  const release = () => {
    dragging.current = false;
    setHeld(false);
  };

  /*
    The object leans towards the pointer even when you are not holding it.

    A few degrees, driven from the whole section rather than from the rings, so
    approaching the orbit tips it before you touch it. This is the cheapest
    dimensionality on the page: the rings are already an ellipse in perspective,
    and moving that perspective slightly is what stops it reading as a drawing
    of an ellipse.
  */
  const lean = (event: React.PointerEvent) => {
    const node = stage.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width - 0.5;
    const py = (event.clientY - box.top) / box.height - 0.5;
    node.style.setProperty('--lean-y', `${px * 10}deg`);
    node.style.setProperty('--lean-x', `${py * -7}deg`);
  };

  const straighten = () => {
    const node = stage.current;
    if (!node) return;
    node.style.setProperty('--lean-y', '0deg');
    node.style.setProperty('--lean-x', '0deg');
  };

  /*
    The acorn burst.

    Clicking the mark scatters a handful of acorns that fall under gravity and
    fade. It does nothing, stores nothing and is never mentioned anywhere, which
    is the entire point of it: this is the screen you open six times a day, and
    a place you live in is allowed exactly one thing that exists only because it
    is a pleasure to find.
  */
  const burst = (event: React.MouseEvent) => {
    const host = stage.current;
    if (!host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const box = host.getBoundingClientRect();
    const originX = event.clientX - box.left;
    const originY = event.clientY - box.top;

    for (let index = 0; index < 14; index++) {
      const seed = document.createElement('span');
      const scale = 0.5 + Math.random() * 0.7;
      seed.className = 'acorn-seed';
      seed.style.left = `${originX}px`;
      seed.style.top = `${originY}px`;
      seed.style.setProperty('--dx', `${(Math.random() - 0.5) * 260}px`);
      seed.style.setProperty('--dy', `${90 + Math.random() * 130}px`);
      seed.style.setProperty('--spin', `${(Math.random() - 0.5) * 540}deg`);
      seed.style.setProperty('--seed-scale', String(scale));
      seed.style.animationDelay = `${Math.random() * 90}ms`;
      seed.addEventListener('animationend', () => seed.remove());
      host.appendChild(seed);
    }
  };

  return (
    <div
      ref={stage}
      onPointerMove={lean}
      onPointerLeave={straighten}
      className="orbit-stage relative select-none"
      aria-hidden="true"
    >
      {/* The caption sits outside the sized box on purpose. Inside it, the
          absolutely positioned orbit takes itself out of flow and the caption
          rises to the top of the box, printing itself over the rings. */}
      <div className="relative" style={{ width: size, height }}>
      <div
        ref={frame}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        className={cn(
          'absolute inset-0 touch-none',
          held ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        {/* The rings, drawn as the ellipses the tilt actually produces rather
            than as circles hoping to be read as depth. */}
        <svg viewBox={`0 0 ${size} ${height}`} className="absolute inset-0 size-full">
          {RINGS.map((ratio) => (
            <ellipse
              key={ratio}
              cx={size / 2}
              cy={height / 2}
              rx={ratio * size}
              ry={ratio * size * Math.cos(TILT)}
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
            />
          ))}
        </svg>

        {/* Squirl itself, between the far half of the orbit and the near half,
            so the applications pass behind it and come back round the front. */}
        <button
          type="button"
          tabIndex={-1}
          // The frame takes pointer capture to keep a spin alive when the
          // cursor outruns it, and a captured pointer delivers its click to
          // the capturing element rather than to what was underneath. Both
          // pressable things here have to keep their own pointerdown.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={burst}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer active:scale-95"
          style={{ zIndex: 2, transition: 'transform 120ms var(--ease-spring)' }}
        >
          {/* The squirrel alone. The wordmark belongs under the mark when
              the lockup is set as a lockup, but at the centre of a ring of
              orbiting nodes it is a line of small type competing with them,
              and the mark alone is what the rings want around them. */}
          <Mark size={Math.round(size * 0.135)} />
        </button>

        {bodies.map((body, index) => (
          <button
            key={body.app.id}
            ref={(node) => {
              dots.current[index] = node;
            }}
            type="button"
            tabIndex={-1}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerEnter={() => onFocus(body.app.id)}
            onPointerLeave={() => onFocus(null)}
            onClick={() => {
              // A drag that ends on a body should not also open it.
              if (Math.abs(velocity.current) > 0.01) return;
              if (body.app.href) router.push(body.app.href);
            }}
            className={cn(
              'absolute left-1/2 top-1/2 -ml-4 -mt-4 flex size-8 items-center justify-center rounded-full',
              body.app.status === 'ready' ? 'cursor-pointer' : 'cursor-grab',
              body.app.accentClass,
            )}
          >
            {/* The node is the application's colour and nothing else. A mark
                shrunk to twenty pixels and set on a moving ellipse is not
                legible as a mark; it is legible as a smudge, and three smudges
                orbiting a squirrel read as clutter. Colour survives the size. */}
            <span
              className={cn(
                'block rounded-full bg-[var(--app-accent)]',
                'transition-[transform,box-shadow] duration-[var(--t-hover)] ease-[var(--ease-spring)]',
                focused === body.app.id
                  ? 'scale-[1.45] shadow-[0_0_0_6px_var(--app-accent-wash)]'
                  : 'shadow-[0_0_0_0_var(--app-accent-wash)]',
                body.app.status === 'ready' ? 'size-3.5' : 'size-2.5 opacity-70',
              )}
            />
          </button>
        ))}
      </div>
      </div>

    </div>
  );
}
