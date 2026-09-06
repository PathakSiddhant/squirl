'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { syncStatus } from '@/app/actions/signal';

/**
 * Notices a background sync landing, and refreshes the page for it.
 *
 * Signal syncs on its own clock, in a process the reader is not necessarily
 * looking at. Without this, a tab left open on the inbox would show whatever
 * it showed at the moment it was opened until the reader manually reloaded it
 * — which defeats the entire point of a background sync, and is exactly the
 * behaviour that was reported as a bug. Nobody should have to reload Signal to
 * find out Signal did something.
 *
 * It polls a server action that reads the scheduler's in-memory state rather
 * than the database, so the poll itself is nearly free, and it only calls
 * `router.refresh()` — a real fetch of the actual page data — when that state
 * says a sync has completed since the last time it checked. A poll that finds
 * nothing new costs one tiny round trip and repaints nothing.
 *
 * Renders nothing. This is a subscription, not a screen.
 */
const POLL_MS = 20_000;

export function AutoRefresh() {
  const router = useRouter();
  // The last completed sync this tab has already reflected. `undefined` means
  // "not checked yet", which must never be treated as a change on the first
  // poll — that would refresh the page the instant it finished loading.
  const lastSeen = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const status = await syncStatus();
        if (cancelled) return;

        if (lastSeen.current !== undefined && status.lastSuccessAt !== lastSeen.current) {
          router.refresh();
        }
        lastSeen.current = status.lastSuccessAt;
      } catch {
        // A poll that fails once is not worth reporting. The next one, twenty
        // seconds later, simply tries again.
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
      }
    };

    // A sync can complete while the tab is in the background, where the timer
    // above is throttled by the browser and may not fire promptly. Coming back
    // to the tab is itself a reason to ask right away rather than wait out
    // whatever is left of the interval.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  return null;
}
