'use client';

import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { ClockCountdown } from '@phosphor-icons/react/dist/csr/ClockCountdown';
import { CloudSlash } from '@phosphor-icons/react/dist/csr/CloudSlash';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { toast } from 'sonner';

import { pauseSyncing, requestSync, resumeSyncing, syncStatus } from '@/app/actions/signal';
import { cn } from '@/lib/cn';
import { IST_TIME_ZONE } from '@/lib/date';
import { sinceLabel } from '@/lib/signal/when';

/**
 * Pause, sync now, and the state of both.
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
 * new". Both look the same from the reader's chair (the screen does not
 * change), but they are different facts: one means a sync ran and found
 * nothing, the other means no sync could run at all. Saying which one stops
 * "why hasn't this updated in hours" from having no answer on screen.
 *
 * ## Paused
 *
 * Pause is a decision, not a fault, so it is drawn as one. The offline and quota
 * states borrow the warm colour because something is wrong and the reader may
 * want to act; a pause is the reader acting, and nothing is wrong. It is
 * carried by ink instead: the pause control becomes the one solid button in the
 * bar, labelled with the thing it will do, because it is the one thing on the
 * screen that is waiting for you. Sync now goes quiet beside it, since there is
 * nothing for it to do.
 *
 * Pause and Resume are a single button whose face changes rather than two
 * buttons swapped in turn. A swap would unmount the element that has keyboard
 * focus at the very moment it is pressed and drop focus onto the page, which is
 * the one place a keyboard user cannot see.
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
  connection, which is why the failed sync, not this, is the real probe.
*/
function subscribeToNetwork(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function SyncControls({ pausedAt: initialPausedAt }: { pausedAt: number | null }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [pending, start] = useTransition();
  // Plain state rather than a second transition. An update made inside an async
  // transition is held back until the whole action has settled, and this one has
  // to answer the click at once: the action ends with a re-render of the page,
  // which can take seconds while a sync pass is writing.
  const [switching, setSwitching] = useState(false);
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
    moment, so "nothing new" (the ordinary empty result) would say a sync
    actually ran and found nothing, when what really happened is that no
    sync could run at all. Those look identical unless this is told apart.
  */
  const [retryAt, setRetryAt] = useState<number | null>(null);

  /*
    The stored pause, as the server last rendered it, kept as state so a click
    answers at once instead of waiting for a round trip. When the server renders
    a different value (another tab paused, or this tab's own refresh landed) the
    state is reset to it. That is adjusting state during render, which React
    recommends over an effect for exactly this case: an effect would paint one
    frame of the old value first.
  */
  const [pausedAt, setPausedAt] = useState(initialPausedAt);
  const [renderedPausedAt, setRenderedPausedAt] = useState(initialPausedAt);
  if (renderedPausedAt !== initialPausedAt) {
    setRenderedPausedAt(initialPausedAt);
    setPausedAt(initialPausedAt);
  }
  const paused = pausedAt !== null;

  // Read from places that must not re-subscribe on every change: the online
  // listener and the poll are each set up once.
  const pausedRef = useRef(pausedAt);
  const switchingRef = useRef(false);
  useEffect(() => {
    pausedRef.current = pausedAt;
  }, [pausedAt]);

  /*
    The clock, kept as state. Reading it during render makes the output depend
    on when React happened to call the component, which is the one thing a
    render must not do. It is refreshed wherever this component already hears
    from the server, so "is the quota still out" is never staler than the last
    answer, and that answer is at most twenty seconds old.
  */
  const [now, setNow] = useState(() => Date.now());

  // A paused Signal has no quota to wait on, so the outage notice is only
  // for a Signal that is trying.
  const waitingOnQuota = !paused && retryAt !== null && retryAt > now;

  const run = () => {
    // Nothing to sync while paused, and the server would refuse anyway. This
    // only spares the round trip, and covers the reconnect listener below.
    if (pausedRef.current !== null) return;

    start(async () => {
      const result = await requestSync();
      setUnreachable(result.offline);
      setAdded(result.paused ? null : result.added);
      setRetryAt(result.retryAt);
      setNow(Date.now());
      router.refresh();
    });
  };

  const pause = async () => {
    if (switchingRef.current) return;
    switchingRef.current = true;
    setSwitching(true);

    const before = pausedAt;
    setPausedAt(Date.now());
    setAdded(null);

    try {
      const result = await pauseSyncing();
      if (result.ok) {
        setPausedAt(result.pausedAt);
      } else {
        setPausedAt(before);
        toast.error(result.error);
      }
    } catch {
      setPausedAt(before);
      toast.error('Could not reach Squirl. Nothing was changed.');
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
    router.refresh();
  };

  const resume = async () => {
    if (switchingRef.current) return;
    switchingRef.current = true;
    setSwitching(true);

    const before = pausedAt;
    setPausedAt(null);

    try {
      const result = await resumeSyncing();
      if (result.ok) {
        // Said once, at the moment it is true, because the inbox is about to
        // look exactly as it did and nothing on it would otherwise say that
        // the gap was left out on purpose.
        toast.success('Syncing resumed. Anything published while paused is skipped.');
      } else {
        setPausedAt(before);
        toast.error(result.error);
      }
    } catch {
      setPausedAt(before);
      toast.error('Could not reach Squirl. It is still paused.');
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
    router.refresh();
  };

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
      // A click in flight owns the answer. Its own result is about to land, and
      // a poll that read the old value a moment earlier must not undo it.
      if (cancelled || !status || switchingRef.current) return;

      setNow(Date.now());
      setRetryAt(status.lastRun?.retryAt ?? null);

      // Paused or resumed somewhere else: another tab, or a restart that found
      // the pause still set. The page is re-rendered too, because the inbox
      // above carries its own line about it.
      if (status.pausedAt !== pausedRef.current) {
        setPausedAt(status.pausedAt);
        router.refresh();
      }
    };
    void poll();
    const timer = setInterval(poll, 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router]);

  // Fades after a moment. A count that stays forever stops being news.
  useEffect(() => {
    if (added === null || waitingOnQuota) return;
    const timer = setTimeout(() => setAdded(null), 4_000);
    return () => clearTimeout(timer);
  }, [added, waitingOnQuota]);

  const resumesAt = retryAt
    ? new Intl.DateTimeFormat('en-IN', {
        timeZone: IST_TIME_ZONE,
        hour: 'numeric',
        minute: '2-digit',
      }).format(retryAt)
    : null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {paused ? (
        // The time can differ by a character of punctuation between the server's
        // formatter and the browser's, and a mismatch there is not worth a
        // hydration warning.
        <span className="hidden text-[0.6875rem] text-ink-3 sm:inline" suppressHydrationWarning>
          Paused since {sinceLabel(pausedAt)}
        </span>
      ) : waitingOnQuota ? (
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
        onClick={paused ? resume : pause}
        aria-busy={switching}
        title={
          paused
            ? 'Resume syncing. Videos published while paused are skipped for good.'
            : 'Pause syncing. Nothing is collected until you resume.'
        }
        aria-label={paused ? 'Resume syncing' : 'Pause syncing'}
        className={cn(
          'flex h-8 items-center justify-center rounded-lg transition-colors duration-[var(--t-state)]',
          paused
            ? // The one solid button in the bar. Icon only on a phone, where the
              // status line is hidden and the label would crowd the mark.
              'gap-1.5 bg-ink px-[9px] text-[0.8125rem] font-medium text-ink-invert hover:opacity-90 sm:px-3'
            : 'w-8 border border-line text-ink-3 hover:bg-surface-2 hover:text-ink',
        )}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={paused ? 'resume' : 'pause'}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-1.5"
          >
            {paused ? (
              <>
                <Play size={13} weight="fill" />
                <span className="hidden sm:inline">Resume</span>
              </>
            ) : (
              <Pause size={15} />
            )}
          </motion.span>
        </AnimatePresence>
      </button>

      <button
        type="button"
        onClick={run}
        disabled={pending || paused}
        title={
          paused
            ? 'Syncing is paused. Resume to sync.'
            : waitingOnQuota
              ? `YouTube's daily limit is used up. Syncing resumes automatically around ${resumesAt}.`
              : offline
                ? 'Offline. Showing everything synced locally.'
                : 'Sync now'
        }
        aria-label={
          paused
            ? 'Sync now, unavailable while syncing is paused'
            : waitingOnQuota
              ? 'Waiting for YouTube quota to reset'
              : offline
                ? 'Offline'
                : 'Sync now'
        }
        className={cn(
          'flex size-8 items-center justify-center rounded-lg border border-line',
          'transition-colors duration-[var(--t-state)]',
          paused
            ? 'cursor-not-allowed text-ink-3 opacity-40'
            : offline || waitingOnQuota
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
