'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Mark } from '@/components/brand/logo';
import { cn } from '@/lib/cn';

import type { LauncherApp } from './launcher-app';

/**
 * Squirl, with its applications around it.
 *
 * The platform model drawn small and left running: the mark in the middle is
 * the environment, each dot on a ring is one installed application in its own
 * accent, and the rings turn slowly in opposite directions. Squirl itself does
 * not move, which is the whole point of the picture.
 *
 * Dots rather than marks. At this size an application's mark is a smudge, and
 * a dot in that application's own colour says "one environment, these things
 * inside it" just as well without pretending to be an icon.
 *
 * It is not decoration only. A dot names its application on hover and opens it
 * on click, so the drawing that explains the product is also the shortest way
 * into it. The ring never stops for a hover: freezing it made a calm drawing
 * feel like it had hitched.
 */

const LANES = [
  { radius: 96, seconds: 64, reverse: false, offset: 0 },
  { radius: 132, seconds: 92, reverse: true, offset: 40 },
];

export function Orbit({ apps, size = 168 }: { apps: LauncherApp[]; size?: number }) {
  const router = useRouter();
  const [hovered, setHovered] = useState<LauncherApp | null>(null);

  // Built applications ride the inner ring because they are the ones you
  // actually reach for. Planned ones sit further out, which is where they are.
  const lanes = [
    { ...LANES[0], apps: apps.filter((app) => app.status === 'ready') },
    { ...LANES[1], apps: apps.filter((app) => app.status !== 'ready') },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="relative select-none" style={{ width: size, height: size }}>
        <svg viewBox="0 0 280 280" className="absolute inset-0 size-full overflow-visible">
          <circle cx="140" cy="140" r="132" fill="none" stroke="var(--line)" strokeWidth="1" />
          <circle cx="140" cy="140" r="96" fill="none" stroke="var(--line)" strokeWidth="1" />
          <circle cx="140" cy="140" r="58" fill="var(--surface-2)" />

          {lanes.map((lane, laneIndex) => (
            <g
              key={laneIndex}
              style={{
                transformOrigin: '140px 140px',
                animation: `orbit-turn ${lane.seconds}s linear infinite`,
                animationDirection: lane.reverse ? 'reverse' : 'normal',
              }}
            >
              {lane.apps.map((app, index) => {
                const angle =
                  ((360 / Math.max(lane.apps.length, 1)) * index + lane.offset) * (Math.PI / 180);
                const cx = 140 + lane.radius * Math.cos(angle);
                const cy = 140 + lane.radius * Math.sin(angle);
                const live = app.status === 'ready';
                const lit = hovered?.id === app.id;

                return (
                  <g
                    key={app.id}
                    className={cn(app.accentClass, live ? 'cursor-pointer' : 'cursor-default')}
                    onMouseEnter={() => setHovered(app)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => live && app.href && router.push(app.href)}
                  >
                    {/* Drawn from the middle out to the dot while it is under
                        the pointer. The picture's whole claim is that these
                        things belong to the thing in the centre, and this is
                        that sentence drawn for one of them at a time. */}
                    <line
                      x1="140"
                      y1="140"
                      x2={cx}
                      y2={cy}
                      stroke="var(--app-accent)"
                      strokeWidth="1"
                      strokeDasharray="3 4"
                      className={cn(
                        'transition-opacity duration-[var(--t-move)]',
                        lit ? 'opacity-55' : 'opacity-0',
                      )}
                    />

                    {/* A quiet halo that only appears under the pointer, and a
                        generous invisible target so a 7px dot is still easy to
                        hit while it is moving. */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r="20"
                      fill="var(--app-accent)"
                      className={cn(
                        'transition-opacity duration-[var(--t-move)]',
                        lit ? 'opacity-15' : 'opacity-0',
                      )}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={live ? 7 : 5.5}
                      fill="var(--app-accent)"
                      className={cn(
                        'origin-center transition-[opacity,r] duration-[var(--t-move)]',
                        live ? 'opacity-100' : 'opacity-45',
                      )}
                      style={{
                        // Only the built ones breathe. A planned application
                        // with a pulse would be claiming a heartbeat it has not
                        // got.
                        animation: live ? `dot-breathe 3.6s var(--ease) ${index * 0.7}s infinite` : undefined,
                        transformOrigin: `${cx}px ${cy}px`,
                      }}
                    />
                  </g>
                );
              })}
            </g>
          ))}
        </svg>

        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Mark size={Math.round(size * 0.17)} />
        </span>
      </div>

      {/* Reserved height, so naming what you are pointing at never nudges the
          drawing above it. */}
      <p className="mt-2.5 flex h-5 items-center text-center text-[0.8125rem]">
        {hovered ? (
          <span className="font-medium text-ink">
            {hovered.name}
            <span className="font-normal text-ink-3">
              {' · '}
              {hovered.status === 'ready' ? 'open it' : 'not built yet'}
            </span>
          </span>
        ) : (
          <span className="text-ink-3">
            {lanes[0].apps.length} built, {lanes[1].apps.length} on the way
          </span>
        )}
      </p>
    </div>
  );
}
