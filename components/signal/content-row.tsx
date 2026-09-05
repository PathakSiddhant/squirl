'use client';

import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Broadcast } from '@phosphor-icons/react/dist/csr/Broadcast';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { X } from '@phosphor-icons/react/dist/csr/X';

import { cn } from '@/lib/cn';
import { IST_TIME_ZONE } from '@/lib/date';
import type { QueueItem } from '@/lib/signal/queue';

/**
 * One item, and everything needed to decide about it without opening it.
 *
 * Six questions, answered in one glance: what is it, who made it, when did it
 * arrive, is it live, how long is it, and what can I do with it. Anything that
 * does not answer one of those is not here. View counts and like counts are
 * the obvious omission, and they are omitted deliberately: they are arguments
 * about what other people thought, on a screen whose only subject is what you
 * want.
 */

function duration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function when(item: QueueItem): string {
  const at = item.kind === 'upcoming' && item.scheduledAt ? item.scheduledAt : item.publishedAt;
  const delta = at - Date.now();

  // An upcoming stream is described by how long until it starts, because that
  // is the only thing anyone wants to know about it.
  if (item.kind === 'upcoming' && delta > 0) {
    const minutes = Math.round(delta / 60_000);
    if (minutes < 60) return `in ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `in ${hours}h`;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIME_ZONE,
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(at);
  }

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(at);
}

const KIND_LABEL: Record<QueueItem['kind'], string | null> = {
  video: null,
  short: 'Short',
  live: 'Live',
  upcoming: 'Upcoming',
};

export function ContentRow({
  item,
  active,
  onOpen,
  onFocus,
  onDone,
  onDismiss,
  onSnooze,
}: {
  item: QueueItem;
  active: boolean;
  onOpen: () => void;
  onFocus?: () => void;
  onDone: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
}) {
  const length = duration(item.durationSeconds);
  const label = KIND_LABEL[item.kind];

  const action =
    'flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-3 hover:text-ink';

  return (
    <div
      onMouseEnter={onFocus}
      className={cn(
        'group/row relative flex items-start gap-3 bg-surface px-3 py-2.5 transition-colors duration-[var(--t-state)]',
        active ? 'bg-surface-2' : 'hover:bg-surface-2',
      )}
    >
      {/* The cursor, as a bar rather than a ring: it marks a position in a list
          rather than selecting an object, and a ring around a whole row at this
          density is a lot of drawing for one piece of information. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1 left-0 w-0.5 rounded-full bg-[var(--app-accent)] transition-opacity duration-[var(--t-state)]',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* Small on purpose. Enough to recognise a video, not enough to browse. */}
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-video w-[6.5rem] shrink-0 overflow-hidden rounded-md border border-line bg-surface-2 sm:w-[7.5rem]"
      >
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-[var(--t-hover)] group-hover/row:scale-[1.04]"
          />
        ) : null}

        {length ? (
          <span className="money absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[0.625rem] text-white">
            {length}
          </span>
        ) : null}
      </button>

      <div className="min-w-0 flex-1">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <span className="line-clamp-2 text-[0.875rem] font-medium leading-snug text-ink">
            {item.title}
          </span>
        </button>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-ink-3">
          {label ? (
            <span
              className={cn(
                'flex items-center gap-1 rounded px-1.5 py-px font-medium',
                item.kind === 'live'
                  ? 'bg-[var(--i-owe-wash)] text-[var(--i-owe-text)]'
                  : 'bg-surface-3 text-ink-2',
              )}
            >
              {item.kind === 'live' ? <Broadcast size={10} weight="fill" /> : null}
              {label}
            </span>
          ) : null}

          <span className="truncate font-medium text-ink-2">{item.channelTitle}</span>
          <span aria-hidden="true">·</span>
          <span>{when(item)}</span>
        </div>
      </div>

      {/* Present but quiet until the row is reached, so forty rows do not draw
          a hundred and twenty buttons. */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 transition-opacity duration-[var(--t-state)]',
          active ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
        )}
      >
        <button type="button" onClick={onSnooze} title="Later  (L)" aria-label="Later" className={action}>
          <Clock size={14} />
        </button>
        <button type="button" onClick={onDismiss} title="Dismiss  (D)" aria-label="Dismiss" className={action}>
          <X size={14} />
        </button>
        <button
          type="button"
          onClick={onDone}
          title="Done  (W)"
          aria-label="Done"
          className={cn(action, 'hover:bg-[var(--in-wash)] hover:text-[var(--in-text)]')}
        >
          <Check size={14} weight="bold" />
        </button>
        <button type="button" onClick={onOpen} title="Open  (↵)" aria-label="Open" className={action}>
          <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}
