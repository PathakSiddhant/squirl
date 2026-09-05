'use client';

import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';

import {
  addChannelById,
  recategoriseChannel,
  removeChannel,
  searchForChannels,
  toggleChannel,
  type SearchState,
} from '@/app/actions/signal';
import { cn } from '@/lib/cn';
import type { ChannelWithCount } from '@/lib/signal/channels';

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
 * The field is a fixed, contained object rather than a bar stretched to the
 * window with a filled button welded to its right edge. That arrangement is
 * the house style of every admin panel ever generated, and it is also simply
 * wrong here: the thing you type is a handle, about fifteen characters, and
 * sizing an input to the viewport tells the reader to expect a paragraph.
 *
 * There is no submit button because there is nothing for it to do that Return
 * does not. The key is shown inside the field instead, which is smaller, quieter
 * and truer.
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

  const add = (youtubeId: string) => {
    setAdding(youtubeId);
    start(async () => {
      await addChannelById(youtubeId);
      router.refresh();
      setAdding(null);
    });
  };

  const watching = channels.filter((channel) => channel.enabled);
  const paused = channels.filter((channel) => !channel.enabled);
  const waiting = channels.reduce((total, channel) => total + channel.waiting, 0);
  const first = channels.length === 0;

  return (
    <div className={cn('flex flex-col', first ? 'gap-0' : 'gap-10')}>
      {/* On a first run this is the whole screen and it is centred; once there
          are channels it becomes a modest header at the top of a list. The two
          jobs are different enough to be laid out differently. */}
      <section className={cn(first && 'flex min-h-[26rem] flex-col items-center justify-center text-center')}>
        <div className={cn(first ? 'max-w-[30rem]' : 'flex items-end justify-between gap-6')}>
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
                : 'Signal watches these and nothing else.'}
            </p>
          </div>

          {!first ? (
            <dl className="hidden shrink-0 items-end gap-6 sm:flex">
              <Stat label="Watching" value={watching.length} />
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
              'transition-[border-color,box-shadow] duration-[var(--t-state)]',
              'focus:border-[var(--app-accent)] focus:outline-none',
            )}
          />

          {/* The key that submits, shown where it happens rather than as a
              button competing with the field for the same job. */}
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

        <p className={cn('mt-3 text-[0.6875rem] leading-relaxed text-ink-3', first ? 'max-w-[26rem]' : 'max-w-[30rem]')}>
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
                  <div key={result.youtubeId} className="flex items-center gap-3 bg-surface px-3 py-2.5">
                    <Avatar url={result.thumbnailUrl} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.875rem] font-medium text-ink">{result.title}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[0.6875rem] text-ink-3">
                        {result.handle ? <span className="truncate">@{result.handle}</span> : null}
                        {subscribers(result.subscriberCount) ? (
                          <span>{subscribers(result.subscriberCount)} subs</span>
                        ) : null}
                        {result.suggestedCategory ? (
                          <span className="rounded bg-surface-3 px-1.5 py-px text-ink-2">
                            {result.suggestedCategory}
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

      {watching.length > 0 ? (
        <Grouped channels={watching} categories={categories} />
      ) : null}

      {paused.length > 0 ? (
        <section>
          <SectionHead title="Paused" count={paused.length} />
          <p className="mb-3 text-[0.75rem] text-ink-3">
            Not synced. Everything they already brought in is still in your queue.
          </p>
          <ChannelRows channels={paused} categories={categories} />
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-right">
      <dt className="text-[0.6875rem] text-ink-3">{label}</dt>
      <dd
        className={cn(
          'money mt-0.5 text-[1.25rem] leading-none',
          accent && value > 0 ? 'text-[var(--app-accent)]' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <header className="mb-3 flex items-baseline gap-3">
      <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
      <span className="money text-[0.6875rem] text-ink-3">{count}</span>
    </header>
  );
}

/**
 * Watched channels, gathered under their categories.
 *
 * Grouping is the reason categories exist at all. A flat list of thirty
 * channels is a list you scan; the same thirty under six headings is a shape
 * you recognise, and it is what makes "what am I following too much of"
 * answerable at a glance.
 */
function Grouped({
  channels,
  categories,
}: {
  channels: ChannelWithCount[];
  categories: Array<{ id: string; name: string; slug: string }>;
}) {
  const byCategory = new Map<string, ChannelWithCount[]>();
  for (const channel of channels) {
    const key = channel.categoryId ?? 'none';
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(channel);
    else byCategory.set(key, [channel]);
  }

  const name = (key: string) =>
    key === 'none' ? 'Uncategorised' : (categories.find((c) => c.id === key)?.name ?? 'Uncategorised');

  const groups = [...byCategory.entries()].sort((a, b) => name(a[0]).localeCompare(name(b[0])));

  return (
    <div className="flex flex-col gap-7">
      {groups.map(([key, group]) => (
        <section key={key}>
          <SectionHead title={name(key)} count={group.length} />
          <ChannelRows channels={group} categories={categories} />
        </section>
      ))}
    </div>
  );
}

function ChannelRows({
  channels,
  categories,
}: {
  channels: ChannelWithCount[];
  categories: Array<{ id: string; name: string; slug: string }>;
}) {
  const router = useRouter();
  const [, start] = useTransition();

  const act = (run: () => Promise<unknown>) =>
    start(async () => {
      await run();
      router.refresh();
    });

  const item =
    'flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.8125rem] text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink';

  return (
    <div className="flex flex-col gap-px overflow-hidden rounded-xl border border-line bg-line">
      {channels.map((channel) => (
        <div key={channel.id} className="group/row flex items-center gap-3 bg-surface px-3 py-2.5">
          <Avatar url={channel.thumbnailUrl} dim={!channel.enabled} />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.875rem] font-medium text-ink">{channel.title}</p>
            <p className="mt-0.5 flex items-center gap-2 text-[0.6875rem] text-ink-3">
              {channel.handle ? <span className="truncate">@{channel.handle}</span> : null}
              {channel.syncStatus === 'error' && channel.lastError ? (
                <span className="truncate text-[var(--i-owe-text)]">{channel.lastError}</span>
              ) : null}
            </p>
          </div>

          {channel.waiting > 0 ? (
            <span className="money shrink-0 rounded-md bg-[var(--app-accent-wash)] px-1.5 py-0.5 text-[0.6875rem] text-[var(--app-accent)]">
              {channel.waiting}
            </span>
          ) : null}

          {/* One menu rather than three buttons per row. Thirty channels would
              otherwise put ninety controls on the screen at rest. */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              aria-label={`Options for ${channel.title}`}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink focus:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
            >
              <DotsThree size={16} weight="bold" />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-dropdown min-w-[12rem] rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)] data-[state=open]:animate-[sheet-in_140ms_var(--ease)]"
              >
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger className={item}>Move to…</DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      sideOffset={4}
                      className="z-dropdown max-h-[16rem] min-w-[10rem] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]"
                    >
                      {categories.map((category) => (
                        <DropdownMenu.Item
                          key={category.id}
                          className={item}
                          onSelect={() => act(() => recategoriseChannel(channel.id, category.id))}
                        >
                          {category.name}
                          {channel.categoryId === category.id ? (
                            <Check size={12} weight="bold" className="ml-auto text-[var(--app-accent)]" />
                          ) : null}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>

                <DropdownMenu.Item
                  className={item}
                  onSelect={() => act(() => toggleChannel(channel.id, !channel.enabled))}
                >
                  {channel.enabled ? 'Pause syncing' : 'Resume syncing'}
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="my-1 h-px bg-line" />

                <DropdownMenu.Item
                  className={cn(item, 'data-[highlighted]:bg-[var(--i-owe-wash)] data-[highlighted]:text-[var(--i-owe-text)]')}
                  onSelect={() => act(() => removeChannel(channel.id))}
                >
                  Remove, with its content
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      ))}
    </div>
  );
}

function Avatar({ url, dim }: { url: string | null; dim?: boolean }) {
  if (!url) return <span className="size-9 shrink-0 rounded-full bg-surface-2" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      className={cn('size-9 shrink-0 rounded-full object-cover', dim && 'opacity-50 grayscale')}
    />
  );
}
