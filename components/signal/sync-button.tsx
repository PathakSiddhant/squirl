'use client';

import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { CloudSlash } from '@phosphor-icons/react/dist/csr/CloudSlash';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { requestSync } from '@/app/actions/signal';
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
 */
export function SyncButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [offline, setOffline] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  const run = () =>
    start(async () => {
      const result = await requestSync();
      setOffline(result.offline);
      setAdded(result.added);
      router.refresh();
    });

  useEffect(() => {
    // The browser's own view of the network. Coming back is a reason to sync
    // immediately rather than at whatever hour the interval lands on.
    const back = () => {
      setOffline(false);
      run();
    };
    const gone = () => setOffline(true);

    window.addEventListener('online', back);
    window.addEventListener('offline', gone);
    setOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', back);
      window.removeEventListener('offline', gone);
    };
    // Mounted once. `run` closes over nothing that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fades after a moment. A count that stays forever stops being news.
  useEffect(() => {
    if (added === null) return;
    const timer = setTimeout(() => setAdded(null), 4_000);
    return () => clearTimeout(timer);
  }, [added]);

  return (
    <div className="flex shrink-0 items-center gap-2">
      {added !== null && !offline ? (
        <span className="hidden text-[0.6875rem] text-ink-3 sm:inline">
          {added === 0 ? 'nothing new' : `${added} new`}
        </span>
      ) : null}

      <button
        type="button"
        onClick={run}
        disabled={pending}
        title={offline ? 'Offline. Showing everything synced locally.' : 'Sync now'}
        aria-label={offline ? 'Offline' : 'Sync now'}
        className={cn(
          'flex size-8 items-center justify-center rounded-lg border border-line',
          'transition-colors duration-[var(--t-state)]',
          offline
            ? 'text-[var(--i-owe-text)]'
            : 'text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-60',
        )}
      >
        {offline ? (
          <CloudSlash size={15} />
        ) : (
          <ArrowsClockwise size={15} className={pending ? 'animate-spin' : undefined} />
        )}
      </button>
    </div>
  );
}
