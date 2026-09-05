'use client';

import { Broadcast } from '@phosphor-icons/react/dist/csr/Broadcast';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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
 * Every decision is optimistic. The row leaves the moment you press the key,
 * because the local database is the authority and the write cannot fail in any
 * way the reader could act on; waiting for a round trip to remove a row you
 * already decided about would make the fast path feel slow, and the fast path
 * is the product.
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
  const [cursor, setCursor] = useState(0);
  const [snoozing, setSnoozing] = useState<QueueItem | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Keyboard. The whole point of the screen is processing a lot of items
  // quickly, and reaching for a mouse forty times is what makes that slow.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (snoozing) return;

      const item = flat[cursor];

      switch (event.key.toLowerCase()) {
        case 'j':
        case 'arrowdown':
          event.preventDefault();
          setCursor((c) => Math.min(c + 1, Math.max(flat.length - 1, 0)));
          break;
        case 'k':
        case 'arrowup':
          event.preventDefault();
          setCursor((c) => Math.max(c - 1, 0));
          break;
        case 'enter':
          if (item) {
            event.preventDefault();
            open(item);
          }
          break;
        case 'w':
          if (item) {
            event.preventDefault();
            settle(item, 'done');
          }
          break;
        case 'd':
          if (item) {
            event.preventDefault();
            settle(item, 'dismissed');
          }
          break;
        case 'l':
          if (item) {
            event.preventDefault();
            setSnoozing(item);
          }
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flat, cursor, settle, open, snoozing]);

  // The cursor is an index into a list that shrinks under it. Clamping keeps it
  // on the item that took the removed one's place, which is what you want when
  // clearing a run of items with one key.
  useEffect(() => {
    if (cursor > flat.length - 1) setCursor(Math.max(flat.length - 1, 0));
  }, [flat.length, cursor]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [cursor, reduceMotion]);

  if (channelCount === 0) {
    return <EmptyQueue kind="no-channels" baselineAt={baselineAt} />;
  }

  if (flat.length === 0) {
    return <EmptyQueue kind={baselineAt ? 'before-baseline' : 'caught-up'} baselineAt={baselineAt} />;
  }

  let index = -1;

  return (
    <div ref={listRef}>
      {/* Live sits above the dated list, because "happening now" is not a date
          and putting it under Today would bury the one thing that expires. */}
      {live.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--i-owe-text)]">
            <Broadcast size={13} weight="fill" className="animate-pulse" />
            Live now
          </h2>
          <div className="flex flex-col gap-px overflow-hidden rounded-xl border border-line bg-line">
            {live
              .filter((item) => !resolved.has(item.id))
              .map((item) => (
                <ContentRow
                  key={item.id}
                  item={item}
                  active={false}
                  onOpen={() => open(item)}
                  onDone={() => settle(item, 'done')}
                  onDismiss={() => settle(item, 'dismissed')}
                  onSnooze={() => setSnoozing(item)}
                />
              ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-8">
        {groups.map((group) => {
          const visible = group.items.filter((item) => !resolved.has(item.id));
          if (visible.length === 0) return null;

          return (
            <section key={group.day}>
              <header className="mb-3 flex items-baseline gap-3">
                <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
                  {group.label}
                </h2>
                <span className="h-px flex-1 bg-line" aria-hidden="true" />
                <span className="money text-[0.6875rem] text-ink-3">{visible.length}</span>
              </header>

              <div className="flex flex-col gap-px overflow-hidden rounded-xl border border-line bg-line">
                <AnimatePresence initial={false}>
                  {visible.map((item) => {
                    index += 1;
                    const at = index;
                    return (
                      <motion.div
                        key={item.id}
                        data-index={at}
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
                          active={at === cursor}
                          onOpen={() => open(item)}
                          onFocus={() => setCursor(at)}
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

      <footer className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-4 text-[0.6875rem] text-ink-3">
        <span>
          {flat.length} waiting
          {summary.snoozed > 0 ? ` · ${summary.snoozed} snoozed` : ''}
        </span>
        <span className="hidden items-center gap-3 sm:flex">
          {[
            ['J K', 'move'],
            ['↵', 'open'],
            ['W', 'done'],
            ['D', 'dismiss'],
            ['L', 'later'],
          ].map(([key, what]) => (
            <span key={key} className="flex items-center gap-1.5">
              <kbd className="rounded-[4px] border border-line px-1 py-px font-mono text-[0.625rem]">
                {key}
              </kbd>
              {what}
            </span>
          ))}
        </span>
      </footer>

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
