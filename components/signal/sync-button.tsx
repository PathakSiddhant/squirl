'use client';

import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { ClockCountdown } from '@phosphor-icons/react/dist/csr/ClockCountdown';
import { CloudSlash } from '@phosphor-icons/react/dist/csr/CloudSlash';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore, useTransition } from 'react';

import { requestSync, syncStatus } from '@/app/actions/signal';
import { cn } from '@/lib/cn';

/**
 * Sync now, and the state of the last one.
 *
 * The control and the status are the same object on purpose. A separate
 * indicator somewhere else on the screen would be a second thing to look at
 * that says nothing the button could not, and the question "is this working"
 * is best answered by the thing you would press if it were not.
 *
 * It listens for the browser coming back online as well. That event fires in
 * the tab, which is a different vantage point from the server's, and reaching
 * the server is what proves the connection: the local process may have been
 * syncing happily the whole time, or may itself be offline. Either way, the
 * reader looking at a reconnected tab is a reason to ask.
 *
 * A full quota outage gets its own state rather than folding into "nothing
 * new". Both look the same from the reader's chair — the screen does not
 * change — but they are different facts: one means a sync ran and found
 * nothing, the other means no sync could run at all. Saying which one stops
 * "why hasn't this updated in hours" from having no answer on screen.
 */
/*
  The browser's own view of the network, subscribed to rather than copied.

  `navigator.onLine` is an external system: it changes without React's
  involvement and it has its own events. Reading it into state on mount means a
  first render that says "online" whether or not that is true, and the reader
  sees the wrong answer for a frame. Subscribing gets the right answer from the
  start, and the server snapshot is `true` because a page rendered on the server
  clearly reached it.

  It is only the tab's opinion. Reaching the server is what actually proves a
  connection, which is why the failed sync — not this — is the real probe.
*/
function subscribeToNetwork(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function SyncButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Two sources for one fact. The browser knows whether the tab has a network;
  // the last sync knows whether YouTube was actually reachable. Either being
  // unhappy is enough to say so.
  const disconnected = !useSyncExternalStore(
    subscribeToNetwork,
    () => navigator.onLine,
    () => true,
  );
  const [unreachable, setUnreachable] = useState(false);
  const offline = disconnected || unreachable;
  const [added, setAdded] = useState<number | null>(null);
  /*
    Set once every YouTube key is out of quota. Distinct from `offline`: the
    connection is fine, the answer just is not going to change until this
    moment, so "nothing new" — the ordinary empty result — would say a sync
    actually ran and found nothing, when what really happened is that no
    sync could run at all. Those look identical unless this is told apart.
  */
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const waitingOnQuota = retryAt !== null && retryAt > Date.now();

  const run = () =>
    start(async () => {
      const result = await requestSync();
      setUnreachable(result.offline);
      setAdded(result.added);
      setRetryAt(result.retryAt);
      router.refresh();
    });

  useEffect(() => {
    // Coming back is a reason to sync immediately rather than at whatever hour
    // the interval happens to land on.
    const back = () => run();
    window.addEventListener('online', back);
    return () => window.removeEventListener('online', back);
    // Mounted once. `run` closes over nothing that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // The button can sit mounted for the whole quota outage, so its own
    // opinion of `retryAt` has to refresh on its own rather than only ever
    // reflecting whatever the last click happened to see.
    let cancelled = false;
    const poll = async () => {
      const status = await syncStatus().catch(() => null);
      if (!cancelled && status) setRetryAt(status.lastRun?.retryAt ?? null);
    };
    void poll();
    const timer = setInterval(poll, 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Fades after a moment. A count that stays forever stops being news.
  useEffect(() => {
    if (added === null || waitingOnQuota) return;
    const timer = setTimeout(() => setAdded(null), 4_000);
    return () => clearTimeout(timer);
  }, [added, waitingOnQuota]);

  const resumesAt = retryAt
    ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(retryAt)
    : null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {waitingOnQuota ? (
        <span className="hidden text-[0.6875rem] text-ink-3 sm:inline">
          YouTube’s limit is used up · back around {resumesAt}
        </span>
      ) : added !== null && !offline ? (
        <span className="hidden text-[0.6875rem] text-ink-3 sm:inline">
          {added === 0 ? 'nothing new' : `${added} new`}
        </span>
      ) : null}

      <button
        type="button"
        onClick={run}
        disabled={pending}
        title={
          waitingOnQuota
            ? `YouTube's daily limit is used up. Syncing resumes automatically around ${resumesAt}.`
            : offline
              ? 'Offline. Showing everything synced locally.'
              : 'Sync now'
        }
        aria-label={waitingOnQuota ? 'Waiting for YouTube quota to reset' : offline ? 'Offline' : 'Sync now'}
        className={cn(
          'flex size-8 items-center justify-center rounded-lg border border-line',
          'transition-colors duration-[var(--t-state)]',
          offline || waitingOnQuota
            ? 'text-[var(--i-owe-text)]'
            : 'text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-60',
        )}
      >
        {waitingOnQuota ? (
          <ClockCountdown size={15} />
        ) : offline ? (
          <CloudSlash size={15} />
        ) : (
          <ArrowsClockwise size={15} className={pending ? 'animate-spin' : undefined} />
        )}
      </button>
    </div>
  );
}
