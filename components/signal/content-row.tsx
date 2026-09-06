'use client';

import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Broadcast } from '@phosphor-icons/react/dist/csr/Broadcast';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { IST_TIME_ZONE } from '@/lib/date';
import { happenedAt, type QueueItem } from '@/lib/signal/queue';
import { atSize } from '@/lib/signal/youtube';

/**
 * One item, and everything needed to decide about it without opening it.
 *
 * Six questions answered at a glance: what is it, who made it, when did it
 * happen, is it live, how long is it, and what can I do with it. Anything not
 * answering one of those is absent. View counts are the obvious omission, and
 * deliberate: they are an argument about what other people thought, on a screen
 * whose only subject is what you want.
 *
 * Drawn large. An earlier version packed forty rows into a screen at the
 * density of a mail client, which is the right shape for subject lines and the
 * wrong one for video: the thumbnail carries most of what a title cannot say,
 * and shrunk to a stamp it carries none of it.
 */

/** 8m, 24m, 1h 12m. Long enough to plan around, short enough to scan. */
function runtime(seconds: number | null): string | null {
  if (seconds === null) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/**
 * When it happened, in words rather than a clock reading.
 *
 * The day is already the heading above it, so repeating a timestamp on every
 * row spends attention on something the reader has been told. What is not
 * obvious, and what actually matters, is how soon an upcoming thing starts.
 */
function when(item: QueueItem): string | null {
  if (item.kind !== 'upcoming') return null;

  const at = happenedAt(item);
  const away = at - Date.now();
  if (away <= 0) return 'starting now';

  const minutes = Math.round(away / 60_000);
  if (minutes < 60) return `in ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(at);
}

/**
 * How long the confirmation shows before the row actually leaves.
 *
 * Long enough that the check or the cross is unmistakably the thing that just
 * happened, short enough that clearing ten items in a row still feels brisk.
 * Matches nothing else in the system's duration scale on purpose: this is a
 * held beat before an exit, not a state change or a layout shift, and it earns
 * its own number rather than borrowing one that means something else.
 */
const CONFIRM_MS = 320;

export function ContentRow({
  item,
  onOpen,
  onDone,
  onDismiss,
}: {
  item: QueueItem;
  onOpen: () => void;
  onDone: () => void;
  onDismiss: () => void;
}) {
  const length = runtime(item.durationSeconds);
  const soon = when(item);
  const thumb = atSize(item.thumbnailUrl, 480);
  const avatar = atSize(item.channelThumbnail, 64);
  const reduceMotion = useReducedMotion();

  /*
    Held here, not in the parent.

    The parent removes the row the instant it is told to — that is what makes
    every other decision in the inbox feel instant, and it must stay that way
    for a reader working through a real backlog. What changes is *when* the row
    tells it: a click now shows what was chosen before it says so, instead of
    the row simply vanishing the moment a button is touched. Reduced motion
    skips straight through, because the point of the flash is to be seen.
  */
  const [settling, setSettling] = useState<'done' | 'dismissed' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Cleared, never fired: if the row leaves the tree for some other reason
    // mid-flash — a refresh landing at the same instant, say — this must not
    // go on to call a handler for a row that is no longer there.
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const settle = (kind: 'done' | 'dismissed', run: () => void) => {
    if (settling) return;
    if (reduceMotion) {
      run();
      return;
    }
    setSettling(kind);
    timer.current = setTimeout(run, CONFIRM_MS);
  };

  const action =
    'flex size-9 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-3 hover:text-ink';

  return (
    // Highlighted while the pointer is on it, and not a moment longer. An
    // earlier version kept a cursor on the last row touched, which left the
    // screen permanently marked at wherever the mouse happened to stop.
    <div
      className={cn(
        'group/row relative flex items-start gap-5 bg-surface p-4 transition-colors duration-[var(--t-state)]',
        settling ? 'pointer-events-none' : 'hover:bg-surface-2',
      )}
    >
      {/* The confirmation. A wash in the colour the reader just chose, and the
          mark for what they chose, so the click reads as landed before the row
          leaves rather than the row simply disappearing under the pointer. */}
      <AnimatePresence>
        {settling ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.1 }}
            className={cn(
              'absolute inset-0 z-10 flex items-center justify-center',
              settling === 'done' ? 'bg-[var(--in-wash)]' : 'bg-[var(--i-owe-wash)]',
            )}
          >
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'flex size-11 items-center justify-center rounded-full text-white shadow-[var(--shadow-pop)]',
                settling === 'done' ? 'bg-[var(--in)]' : 'bg-[var(--i-owe)]',
              )}
            >
              {settling === 'done' ? (
                <Check size={22} weight="bold" />
              ) : (
                <X size={22} weight="bold" />
              )}
            </motion.span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/*
        The picture is the only thing that opens the video, and only on a double
        click. A row you are scanning with the keyboard, marking done and
        dismissing is a row your pointer crosses constantly; making any of that
        a single click means a stray press sends you to YouTube in the middle of
        clearing a queue. The arrow at the end of the row is the one-click way,
        and it is a button that says so.
      */}
      <button
        type="button"
        onDoubleClick={onOpen}
        title="Double-click to open on YouTube"
        className="relative aspect-video w-[12rem] shrink-0 cursor-pointer select-none overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line transition-shadow duration-[var(--t-hover)] hover:ring-[var(--app-accent)] sm:w-[15rem]"
      >
        {thumb ? (
          <Image
            src={thumb}
            alt=""
            fill
            sizes="(min-width: 640px) 240px, 192px"
            quality={90}
            className="object-cover transition-transform duration-[var(--t-hover)] ease-[var(--ease-spring)] group-hover/row:scale-[1.04]"
          />
        ) : null}

        {length ? (
          <span className="signal-meta absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[0.75rem] font-medium text-white">
            {length}
          </span>
        ) : null}

        {item.kind === 'live' ? (
          <span className="signal-meta absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-[var(--i-owe)] px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-white">
            <Broadcast size={10} weight="fill" />
            Live
          </span>
        ) : null}
      </button>

      <div className="min-w-0 flex-1 py-1">
        <h3 className="line-clamp-2 text-[1.125rem] font-medium leading-snug tracking-[-0.015em] text-ink">
          {item.title}
        </h3>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {avatar ? (
            <Image
              src={avatar}
              alt=""
              width={22}
              height={22}
              quality={90}
              className="size-[22px] shrink-0 rounded-full object-cover"
            />
          ) : null}

          <span className="truncate text-[0.875rem] font-medium text-ink-2">
            {item.channelTitle}
          </span>

          {item.kind === 'upcoming' && soon ? (
            <span className="signal-meta rounded bg-[var(--out-wash)] px-1.5 py-0.5 text-[0.75rem] font-medium text-[var(--out-text)]">
              {soon}
            </span>
          ) : null}
        </div>
      </div>

      {/* Quiet until the row is reached, so forty rows do not draw a hundred
          and twenty buttons at rest.

          There was a fourth button here, "later", which put an item back in the
          queue at a chosen hour. It is gone. YouTube already has Watch Later
          and is welcome to it: a queue whose whole promise is that it gets
          shorter should not ship the one control that lets you avoid making a
          decision. Three buttons, and each of them ends the item. */}
      <div className="flex shrink-0 items-center gap-1 self-center opacity-0 transition-opacity duration-[var(--t-state)] group-hover/row:opacity-100">
        <button
          type="button"
          onClick={() => settle('dismissed', onDismiss)}
          disabled={settling !== null}
          title="Dismiss"
          aria-label="Dismiss"
          // The two irreversible-feeling actions each take their own colour on
          // hover, so the hand knows which one it is over before it commits.
          className={cn(action, 'hover:bg-[var(--i-owe-wash)] hover:text-[var(--i-owe-text)]')}
        >
          <X size={17} />
        </button>
        <button
          type="button"
          onClick={() => settle('done', onDone)}
          disabled={settling !== null}
          title="Done"
          aria-label="Done"
          className={cn(action, 'hover:bg-[var(--in-wash)] hover:text-[var(--in-text)]')}
        >
          <Check size={17} weight="bold" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          disabled={settling !== null}
          title="Open on YouTube"
          aria-label="Open"
          className={action}
        >
          <ArrowUpRight size={17} />
        </button>
      </div>
    </div>
  );
}
