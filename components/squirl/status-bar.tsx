'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { IST_TIME_ZONE } from '@/lib/date';

/**
 * The strip along the top: what is true right now.
 *
 * A launcher that reports on live things ought to prove it is live, and a
 * clock is the cheapest honest proof there is. The seconds are the point. A
 * date alone could have been rendered into the page a week ago and nobody
 * could tell; a second hand cannot be faked by a static build.
 *
 * Resolved in IST like everything else in Squirl, because the hour that
 * matters is the one in the room the machine is in.
 */
export function StatusBar() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const format = new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Aligned to the next whole second rather than started immediately, so the
    // display does not sit a fraction behind the real second for the life of
    // the page.
    const tick = () => setNow(format.format(new Date()));
    tick();
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

  const cell = 'flex items-center gap-2 text-[0.6875rem] tracking-[0.02em] text-ink-3';

  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-2.5">
      <div className="flex items-center gap-4">
        <span className={cell}>
          <span className="relative flex size-1.5">
            <span className="live-ping absolute inset-0 rounded-full bg-[var(--in)]" />
            <span className="relative size-1.5 rounded-full bg-[var(--in)]" />
          </span>
          <span className="font-medium text-ink-2">All local</span>
          <span className="hidden sm:inline">no sync, no cloud, no account</span>
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Reserved at a fixed width in tabular figures. A clock that changes
            its own width every time a 1 goes past drags the row beside it. */}
        <span
          className="money text-[0.75rem] tabular-nums text-ink-2"
          suppressHydrationWarning
          aria-label="Local time"
        >
          {now ?? '--:--:--'}
        </span>

        <span className={cn(cell, 'hidden sm:flex')}>IST</span>
      </div>
    </div>
  );
}
