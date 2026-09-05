'use client';

import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useActionState, useRef, useState, useTransition } from 'react';

import {
  addChannelById,
  createCategory,
  reclassifyAll,
  searchForChannels,
  type SearchState,
} from '@/app/actions/signal';
import { cn } from '@/lib/cn';
import type { ChannelWithCount } from '@/lib/signal/channels';
import { atSize } from '@/lib/signal/youtube';

import { ChannelBoard, type Group } from './channel-board';

const INITIAL: SearchState = { query: '', results: [], error: null };

/** A few real channels, so the empty screen can be tried rather than only read. */
const EXAMPLES = ['@mkbhd', '@fireship', '@veritasium'];

/** Rounded the way people say it, not the way a number is. */
function subscribers(count: number | null): string | null {
  if (count === null) return null;
  if (count >= 10_000_000) return `${Math.round(count / 1_000_000)}M`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return String(count);
}

/**
 * Choosing what Signal watches.
 *
 * The field is a contained object rather than a bar stretched across the window
 * with a filled button welded to its right edge, which is the house style of
 * every admin panel ever generated. What you type here is a handle, about
 * fifteen characters; sizing the input to the viewport promises a paragraph.
 * There is no submit button either, because Return already does that job, so
 * the key is shown inside the field instead.
 */
export function ChannelManager({
  channels,
  categories,
}: {
  channels: ChannelWithCount[];
  categories: Array<{ id: string; name: string; slug: string }>;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [state, search, searching] = useActionState(searchForChannels, INITIAL);
  const [, start] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [naming, setNaming] = useState(false);
  const [sorting, setSorting] = useState(false);
  const newCategory = useRef<HTMLInputElement>(null);

  const add = (youtubeId: string) => {
    setAdding(youtubeId);
    start(async () => {
      await addChannelById(youtubeId);
      router.refresh();
      setAdding(null);
    });
  };

  const first = channels.length === 0;
  const watching = channels.filter((channel) => channel.enabled).length;
  const waiting = channels.reduce((total, channel) => total + channel.waiting, 0);

  // Grouped here rather than in the grid, so the grid stays a way of drawing a
  // grouping rather than a component with opinions about what the groups are.
  const grouped: Group[] = [
    ...categories.map((category) => ({
      id: category.id,
      name: category.name,
      channels: channels.filter((channel) => channel.categoryId === category.id),
    })),
    {
      // Always present and always last, because it is where a newly added
      // channel lands and it has to be somewhere you can drag out of.
      id: 'unfiled',
      name: 'Unsorted',
      channels: channels.filter(
        (channel) => !channel.categoryId || !categories.some((c) => c.id === channel.categoryId),
      ),
    },
    // An empty group the reader made is kept, because they made it on purpose
    // and it is a target to drop into. An empty seeded one is just clutter.
  ].filter((group) => group.channels.length > 0 || group.id === 'unfiled');

  return (
    <div className={cn('flex flex-col', first ? 'gap-0' : 'gap-8')}>
      <section
        className={cn(first && 'flex min-h-[26rem] flex-col items-center justify-center text-center')}
      >
        <div className={cn(first ? 'max-w-[30rem]' : 'flex flex-wrap items-end justify-between gap-6')}>
          <div>
            <h1
              className={cn(
                'font-serif font-normal tracking-[-0.02em] text-ink',
                first ? 'text-[2rem] leading-tight' : 'text-[1.75rem]',
              )}
            >
              {first ? 'Choose what you follow.' : 'Channels'}
            </h1>
            <p className={cn('mt-2 text-[0.875rem] leading-relaxed text-ink-3', first && 'mx-auto')}>
              {first
                ? 'Signal watches only the channels you name. Nothing is suggested, and nothing arrives that you did not ask for.'
                : 'Drag a face to re-order it, or into another group. Double-click to open it on YouTube.'}
            </p>
          </div>

          {!first ? (
            <dl className="flex shrink-0 items-end gap-6">
              <Stat label="Watching" value={watching} />
              <Stat label="Waiting" value={waiting} accent />
            </dl>
          ) : null}
        </div>

        <form
          action={search}
          className={cn('relative mt-6', first ? 'mx-auto w-full max-w-[26rem]' : 'max-w-[26rem]')}
        >
          <MagnifyingGlass
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            name="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="@handle, or a channel link"
            autoComplete="off"
            spellCheck={false}
            aria-label="Find a channel"
            className={cn(
              'field h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-14',
              'text-[0.875rem] text-ink placeholder:text-ink-3',
              'transition-[border-color] duration-[var(--t-state)]',
              'focus:border-[var(--app-accent)] focus:outline-none',
            )}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {searching ? (
              <span className="text-[0.6875rem] text-ink-3">looking…</span>
            ) : query.trim() ? (
              <kbd className="rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3">
                ↵
              </kbd>
            ) : null}
          </span>
        </form>

        {first ? (
          <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[0.75rem] text-ink-3">
            <span>Try</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  const form = new FormData();
                  form.set('query', example);
                  start(() => search(form) as unknown as Promise<void>);
                }}
                className="rounded-md border border-line px-2 py-0.5 font-mono text-[0.6875rem] text-ink-2 transition-colors duration-[var(--t-state)] hover:border-[var(--app-accent)] hover:text-ink"
              >
                {example}
              </button>
            ))}
          </p>
        ) : null}

        <p className={cn('mt-3 max-w-[30rem] text-[0.6875rem] leading-relaxed text-ink-3')}>
          A handle or link resolves for one unit of YouTube&rsquo;s daily quota. Searching by words
          costs a hundred, and only a hundred of those are allowed a day.
        </p>

        {state.error ? (
          <p className="mt-4 max-w-[26rem] rounded-lg border border-line bg-surface px-3 py-2 text-[0.8125rem] text-[var(--i-owe-text)]">
            {state.error}
          </p>
        ) : null}

        <AnimatePresence initial={false}>
          {state.results.length > 0 ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn('mt-5 w-full', first ? 'max-w-[30rem]' : 'max-w-[40rem]')}
            >
              <div className="flex flex-col gap-px overflow-hidden rounded-xl border border-line bg-line text-left">
                {state.results.map((result) => (
                  <div
                    key={result.youtubeId}
                    className="flex items-center gap-3 bg-surface px-3 py-2.5"
                  >
                    {atSize(result.thumbnailUrl, 88) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={atSize(result.thumbnailUrl, 88) ?? undefined}
                        alt=""
                        loading="lazy"
                        className="size-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="size-9 shrink-0 rounded-full bg-surface-2" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.875rem] font-medium text-ink">{result.title}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[0.6875rem] text-ink-3">
                        {result.handle ? <span className="truncate">@{result.handle}</span> : null}
                        {subscribers(result.subscriberCount) ? (
                          <span className="signal-meta">
                            {subscribers(result.subscriberCount)} subs
                          </span>
                        ) : null}
                      </p>
                    </div>

                    {result.alreadyAdded ? (
                      <span className="flex shrink-0 items-center gap-1.5 pr-1 text-[0.75rem] text-ink-3">
                        <Check size={13} weight="bold" />
                        Added
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => add(result.youtubeId)}
                        disabled={adding === result.youtubeId}
                        className={cn(
                          'flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5',
                          'text-[0.75rem] font-medium text-[var(--app-accent)]',
                          'transition-colors duration-[var(--t-state)] hover:bg-[var(--app-accent-wash)]',
                          'disabled:opacity-60',
                        )}
                      >
                        {adding === result.youtubeId ? 'Adding…' : 'Add'}
                        <ArrowRight size={12} weight="bold" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      {!first ? (
        <>
          {/* The two things you can do to the shelf itself, rather than to any
              one channel on it. */}
          <div className="flex flex-wrap items-center gap-2">
            {naming ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newCategory.current?.value ?? '';
                  setNaming(false);
                  if (!name.trim()) return;
                  start(async () => {
                    await createCategory(name);
                    router.refresh();
                  });
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={newCategory}
                  autoFocus
                  placeholder="Football, F1, Long reads…"
                  maxLength={32}
                  onBlur={() => setNaming(false)}
                  className="field h-8 w-[13rem] rounded-lg border border-[var(--app-accent)] bg-surface px-2.5 text-[0.8125rem] text-ink placeholder:text-ink-3 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-ink px-2.5 py-1.5 text-[0.75rem] font-medium text-ink-invert"
                >
                  Create
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setNaming(true)}
                className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[0.75rem] text-ink-2 transition-colors duration-[var(--t-state)] hover:border-[var(--app-accent)] hover:text-ink"
              >
                <Plus size={12} weight="bold" />
                New group
              </button>
            )}

            <button
              type="button"
              disabled={sorting}
              onClick={() => {
                setSorting(true);
                start(async () => {
                  await reclassifyAll();
                  router.refresh();
                  setSorting(false);
                });
              }}
              title="Anything you filed by hand is left alone"
              className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[0.75rem] text-ink-2 transition-colors duration-[var(--t-state)] hover:border-[var(--app-accent)] hover:text-ink disabled:opacity-60"
            >
              <Sparkle size={12} weight={sorting ? 'fill' : 'regular'} />
              {sorting ? 'Sorting…' : 'Sort them for me'}
            </button>
          </div>

          <ChannelBoard groups={grouped} />
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <dt className="signal-label">{label}</dt>
      <dd
        className={cn(
          'signal-meta mt-1 text-[1.375rem] leading-none',
          accent && value > 0 ? 'text-[var(--app-accent)]' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
