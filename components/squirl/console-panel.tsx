'use client';

import { useEffect, useState } from 'react';

import { IST_TIME_ZONE } from '@/lib/date';

/**
 * The right-hand column: what is true about this machine, right now.
 *
 * Squirl reporting on Squirl. Everything here belongs to the environment
 * rather than to anything installed in it, which is the line that keeps this
 * panel honest: how many applications are here, how many are real, how big the
 * file has got, when it was last written. An application's own figures are its
 * own business and stay on its tile.
 *
 * The clock is the reason the column exists. A launcher full of numbers read
 * off disk has no way of proving it is looking at the disk now rather than
 * showing you a page built last week, and a second hand settles that
 * instantly.
 */
export function ConsolePanel({
  apps,
  built,
  size,
  written,
}: {
  apps: number;
  built: number;
  size: string;
  written: string;
}) {
  const [clock, setClock] = useState<{ time: string; day: string } | null>(null);

  useEffect(() => {
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const day = new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIME_ZONE,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    const tick = () => {
      const now = new Date();
      setClock({ time: time.format(now), day: day.format(now) });
    };

    tick();
    // Aligned to the next whole second, so the display never sits a fraction
    // behind the real one for the life of the page.
    let interval: ReturnType<typeof setInterval>;
    const align = setTimeout(() => {
      tick();
      interval = setInterval(tick, 1000);
    }, 1000 - (Date.now() % 1000));

    return () => {
      clearTimeout(align);
      clearInterval(interval);
    };
  }, []);

  const rows = [
    { label: 'Installed', value: `${apps}` },
    { label: 'Built', value: `${built}` },
    { label: 'On disk', value: size },
    { label: 'Written', value: written },
  ];

  return (
    <aside className="rise flex w-[11rem] flex-col items-end text-right" style={{ animationDelay: '260ms' }}>
      <p
        className="money text-[1.5rem] leading-none tracking-[-0.02em] text-ink tabular-nums"
        suppressHydrationWarning
        aria-label="Local time"
      >
        {clock?.time ?? '--:--:--'}
      </p>
      <p className="mt-1.5 text-[0.6875rem] text-ink-3" suppressHydrationWarning>
        {clock?.day ?? ' '} · IST
      </p>

      <span className="my-3 h-px w-9 bg-line" aria-hidden="true" />

      <dl className="flex w-full flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2">
            <dt className="shrink-0 text-[0.6875rem] text-ink-3">{row.label}</dt>
            <dd className="money text-[0.75rem] text-ink-2">{row.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
