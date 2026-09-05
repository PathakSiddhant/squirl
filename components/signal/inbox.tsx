'use client';

import { Broadcast } from '@phosphor-icons/react/dist/csr/Broadcast';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { decide } from '@/app/actions/signal';
import type { DayGroup, QueueItem } from '@/lib/signal/queue';

import { ContentRow } from './content-row';
import { EmptyQueue } from './empty-queue';
import { QueueHeader, type Lens, type LensCounts } from './queue-header';

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
function through(item: QueueItem, lens: Lens): boolean {
  if (lens === 'live') return item.kind === 'live';
  if (lens === 'soon') return item.kind === 'upcoming';
  return true;
}

export function Inbox({
  groups,
  live,
  channelCount,
  baselineAt,
}: {
  groups: DayGroup[];
  live: QueueItem[];
  channelCount: number;
  baselineAt: number | null;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  // Rows removed here but not yet re-fetched from the server. Without this the
  // row sits there until the refresh lands and every keystroke feels ignored.
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [lens, setLens] = useState<Lens>('all');

  // One flat list in visual order. The day headings are a way of drawing it,
  // not a level of nesting to navigate.
  const flat = groups.flatMap((group) => group.items).filter((item) => !resolved.has(item.id));

  // Counted before the lens is applied, so a lens never hides the fact that it
  // has something behind it.
  const counts: LensCounts = {
    all: flat.length,
    live: flat.filter((item) => through(item, 'live')).length,
    soon: flat.filter((item) => through(item, 'soon')).length,
  };

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

  const showing = flat.filter((item) => through(item, lens));

  return (
    <div>
      <QueueHeader
        waiting={flat.length}
        live={counts.live}
        lens={lens}
        counts={counts}
        onLens={setLens}
      />

      {/* Live sits above the dated list, because "happening now" is not a date
          and putting it under Today would bury the one thing that expires. */}
      {lens !== 'soon' && live.length > 0 ? (
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
                />
              ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-10">
        {groups.map((group) => {
          const visible = group.items.filter(
            (item) => !resolved.has(item.id) && through(item, lens),
          );
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

      {showing.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line py-12 text-center text-[0.875rem] text-ink-3">
          Nothing here fits that. The rest is still waiting.
        </p>
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
