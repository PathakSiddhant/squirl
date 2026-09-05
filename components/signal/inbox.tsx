'use client';

import { Broadcast } from '@phosphor-icons/react/dist/csr/Broadcast';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { decide, snoozeUntil } from '@/app/actions/signal';
import { cn } from '@/lib/cn';
import type { DayGroup, QueueItem, QueueSummary } from '@/lib/signal/queue';

import { ContentRow } from './content-row';
import { EmptyQueue } from './empty-queue';
import { SnoozeMenu } from './snooze-menu';

/**
 * The inbox.
 *
 * A list, not a gallery. YouTube already has the grid of enormous thumbnails
 * and it is very good at making you browse; this is the other thing, the one
 * that lets you look at forty items and decide about all of them in a minute.
 * So the rows are dense, the type carries the hierarchy, and the picture is
 * small enough to identify a video without being large enough to sell one.
 *
 * Every decision is optimistic. The row leaves the moment it is clicked,
 * because the local database is the authority and the write cannot fail in any
 * way the reader could act on; waiting for a round trip to remove a row already
 * decided about would make the whole screen feel slow.
 *
 * There is no keyboard layer, and that is deliberate. A window-level key
 * handler assumes this screen has the reader's attention, which a page you
 * leave open in a tab does not: a stray keystroke meant for something else
 * would dismiss a video. Everything here is done by pointing at it.
 */
export function Inbox({
  groups,
  live,
  summary,
  channelCount,
  baselineAt,
}: {
  groups: DayGroup[];
  live: QueueItem[];
  summary: QueueSummary;
  channelCount: number;
  baselineAt: number | null;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  // Rows removed here but not yet re-fetched from the server. Without this the
  // row sits there until the refresh lands and every keystroke feels ignored.
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [snoozing, setSnoozing] = useState<QueueItem | null>(null);

  // One flat list in visual order, which is what the keyboard walks. The day
  // headings are a way of drawing it, not a level of nesting to navigate.
  const flat = groups.flatMap((group) => group.items).filter((item) => !resolved.has(item.id));

  const settle = useCallback(
    (item: QueueItem, decision: 'done' | 'dismissed') => {
      setResolved((current) => new Set(current).add(item.id));
      void decide(item.id, decision).then(() => router.refresh());
    },
    [router],
  );

  const open = useCallback((item: QueueItem) => {
    window.open(`https://www.youtube.com/watch?v=${item.youtubeId}`, '_blank', 'noopener,noreferrer');
  }, []);

  if (channelCount === 0) {
    return <EmptyQueue kind="no-channels" baselineAt={baselineAt} />;
  }

  if (flat.length === 0) {
    return <EmptyQueue kind={baselineAt ? 'before-baseline' : 'caught-up'} baselineAt={baselineAt} />;
  }

  return (
    <div>
      {/* Live sits above the dated list, because "happening now" is not a date
          and putting it under Today would bury the one thing that expires. */}
      {live.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 font-serif text-[1.5rem] font-normal tracking-[-0.02em] text-[var(--i-owe-text)]">
            <Broadcast size={19} weight="fill" className="animate-pulse" />
            Live now
          </h2>
          <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line">
            {live
              .filter((item) => !resolved.has(item.id))
              .map((item) => (
                <ContentRow
                  key={item.id}
                  item={item}
                  onOpen={() => open(item)}
                  onDone={() => settle(item, 'done')}
                  onDismiss={() => settle(item, 'dismissed')}
                  onSnooze={() => setSnoozing(item)}
                />
              ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-10">
        {groups.map((group) => {
          const visible = group.items.filter((item) => !resolved.has(item.id));
          if (visible.length === 0) return null;

          return (
            <section key={group.day}>
              {/* The day, set large, with the count beside it. No rule across
                  the screen: a hairline stretched to the window is a divider
                  drawing attention to itself, and the heading already separates
                  these perfectly well on its own. */}
              <header className="mb-4 flex items-baseline gap-3">
                <h2 className="font-serif text-[1.5rem] font-normal tracking-[-0.02em] text-ink">
                  {group.label}
                </h2>
                <span className="signal-meta text-[0.875rem] text-ink-3">{visible.length}</span>
              </header>

              <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line">
                <AnimatePresence initial={false}>
                  {visible.map((item) => {
                    return (
                      <motion.div
                        key={item.id}
                        layout={!reduceMotion}
                        exit={
                          reduceMotion
                            ? { opacity: 0 }
                            : // Leaves sideways rather than fading in place: the
                              // item is being sent somewhere, and a fade reads as
                              // it having been forgotten instead.
                              { opacity: 0, x: 24, height: 0, transition: { duration: 0.18 } }
                        }
                        transition={{ type: 'spring', stiffness: 520, damping: 44 }}
                      >
                        <ContentRow
                          item={item}
                          onOpen={() => open(item)}
                          onDone={() => settle(item, 'done')}
                          onDismiss={() => settle(item, 'dismissed')}
                          onSnooze={() => setSnoozing(item)}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          );
        })}
      </div>

      {/* A count, and nothing else. No rule above it: a hairline drawn to the
          window edge is a divider announcing itself. No key legend either,
          because this screen no longer has keys to announce. */}
      <p className="mt-8 text-[0.8125rem] text-ink-3">
        {flat.length} waiting
        {summary.snoozed > 0 ? ` · ${summary.snoozed} snoozed` : ''}
      </p>

      {snoozing ? (
        <SnoozeMenu
          item={snoozing}
          onClose={() => setSnoozing(null)}
          onChoose={(until) => {
            const item = snoozing;
            setSnoozing(null);
            setResolved((current) => new Set(current).add(item.id));
            void snoozeUntil(item.id, until).then(() => router.refresh());
          }}
        />
      ) : null}
    </div>
  );
}

/** Shown when the queue empties under you. Not a reward, just an acknowledgement. */
export function CaughtUp() {
  return (
    <span className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
      <Check size={14} weight="bold" className="text-[var(--in)]" />
      You’re caught up.
    </span>
  );
}
