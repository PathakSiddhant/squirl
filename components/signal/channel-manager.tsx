'use client';

import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { ArrowsInLineVertical } from '@phosphor-icons/react/dist/csr/ArrowsInLineVertical';
import { ArrowsOutLineVertical } from '@phosphor-icons/react/dist/csr/ArrowsOutLineVertical';
import { ListBullets } from '@phosphor-icons/react/dist/csr/ListBullets';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';

import {
  addChannelById,
  createCategory,
  reclassifyAll,
  searchForChannels,
  type AddChannelResult,
  type SearchState,
} from '@/app/actions/signal';
import { cn } from '@/lib/cn';
import type { ChannelWithCount } from '@/lib/signal/channels';
import { atSize } from '@/lib/signal/youtube';

import { ChannelAddedDialog } from './channel-added-dialog';
import { ChannelBoard, type Group, type ShelfView } from './channel-board';

const INITIAL: SearchState = { query: '', results: [], error: null };

/*
  Which layout the reader last chose.

  Held outside React and read through `useSyncExternalStore` rather than copied
  into state by an effect on mount. The browser is the owner of this value, the
  server has no opinion about it, and subscribing is how you read something a
  component does not own without a render pass that shows the wrong answer
  first. It comes free with the `storage` event, so opening the shelf in two
  tabs keeps both on the same layout.
*/
const VIEW_KEY = 'signal.shelf-view';
const viewListeners = new Set<() => void>();

function readView(): ShelfView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'rows' ? 'rows' : 'faces';
  } catch {
    // Storage switched off is still a browser that can draw a shelf. It simply
    // starts on faces every time.
    return 'faces';
  }
}

function writeView(next: ShelfView): void {
  try {
    localStorage.setItem(VIEW_KEY, next);
  } catch {
    /* the choice just does not outlive the tab */
  }
  for (const listener of viewListeners) listener();
}

function subscribeView(listener: () => void): () => void {
  viewListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    viewListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

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
 * A number that walks to its value instead of appearing at it.
 *
 * Worth the trouble only because these numbers change while you are looking at
 * them: a sync lands, a video is dismissed, and a figure that simply swaps is a
 * figure you do not notice changed. Kept short — a count-up long enough to
 * watch is a count-up that is wasting your time.
 */
function useCountUp(value: number, enabled: boolean): number {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const from = shown;
    const distance = value - from;
    if (distance === 0) return;

    const started = performance.now();
    const duration = Math.min(620, 220 + Math.abs(distance) * 22);

    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      // Decelerating, so the last digits settle rather than slam.
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(from + distance * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // Deliberately not depending on `shown`: it changes on every frame, and a
    // restart per frame is an animation that never finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled]);

  // Nothing is animating when motion is turned down, so nothing needs to be
  // stored: the answer is simply the number.
  return enabled ? shown : value;
}

/**
 * Choosing what Signal watches.
 *
 * One field does two jobs, and which one it is doing depends on whether what
 * you typed is already on your shelf. Typing filters the faces below, live,
 * because the first question anyone asks a list of thirty-nine things is
 * "where is the one I mean". Pressing Return spends a unit of YouTube's quota
 * looking for a channel you do not have yet. Two inputs for those two jobs
 * would be a form; one input that tells you which job it is about to do is a
 * tool.
 *
 * It is a contained object rather than a bar stretched across the window with a
 * filled button welded to its right edge, which is the house style of every
 * admin panel ever generated. What you type here is a handle, about fifteen
 * characters; sizing the input to the viewport promises a paragraph.
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
  const [added, setAdded] = useState<AddChannelResult | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [naming, setNaming] = useState(false);
  const [sorting, setSorting] = useState(false);
  const view = useSyncExternalStore(subscribeView, readView, () => 'faces' as ShelfView);
  // A click, not a boolean: the board folds when this changes, and two folds in
  // a row have to be two distinguishable events.
  const [fold, setFold] = useState<{ at: number; folded: boolean } | undefined>(undefined);
  const newCategory = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLInputElement>(null);

  const add = (youtubeId: string) => {
    setAdding(youtubeId);
    setAddError(null);
    start(async () => {
      const result = await addChannelById(youtubeId);
      router.refresh();
      setAdding(null);

      if (result.error || !result.channelId) {
        setAddError(result.error ?? 'Something went wrong adding that channel.');
        return;
      }

      // The search is finished the moment something is added, and clearing
      // the field is enough to say so: the results panel below is gated on
      // there being an active query (see `filter`), so an empty field hides
      // it immediately rather than going on showing a snapshot from before
      // the add, where the very item just added still read "Add" because
      // nothing had told that array anything had happened.
      setQuery('');
      setAdded(result);
    });
  };

  const first = channels.length === 0;
  const waiting = channels.reduce((total, channel) => total + channel.waiting, 0);

  const filter = query.trim();
  const onShelf = filter
    ? channels.filter(
        (channel) =>
          channel.title.toLowerCase().includes(filter.toLowerCase()) ||
          (channel.handle ?? '').toLowerCase().includes(filter.toLowerCase()),
      ).length
    : 0;

  // Grouped here rather than in the board, so the board stays a way of drawing
  // a grouping rather than a component with opinions about what the groups are.
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
    <div className={cn('flex flex-col', first ? 'gap-0' : 'gap-7')}>
      <section
        className={cn(
          first && 'flex min-h-[26rem] flex-col items-center justify-center text-center',
        )}
      >
        <div
          className={cn(
            first ? 'max-w-[30rem]' : 'flex flex-wrap items-end justify-between gap-x-10 gap-y-6',
          )}
        >
          <div className="min-w-0">
            <h1
              className={cn(
                'font-serif font-normal tracking-[-0.02em] text-ink',
                first ? 'text-[2rem] leading-tight' : 'text-[2rem] leading-none',
              )}
            >
              {first ? 'Choose what you follow.' : 'Channels'}
            </h1>
            <p
              className={cn(
                'mt-2.5 max-w-[34rem] text-[0.875rem] leading-relaxed text-ink-3',
                first && 'mx-auto',
              )}
            >
              {first
                ? 'Signal watches only the channels you name. Nothing is suggested, and nothing arrives that you did not ask for.'
                : 'Drag a face to re-order it, or into another group. Rest on one to see who it is. Double-click to open it on YouTube.'}
            </p>
          </div>

          {/* Two figures, and only two. There was a coloured bar here showing
              how the shelf split across groups, and a sentence about how many
              subscribers those channels had between them — both cut, because
              neither answered a question anyone had come to this page with.
              How many channels do I follow, and how much is waiting for me:
              that is the whole of what this screen knows and the whole of what
              it should say. */}
          {!first ? (
            <div className="flex shrink-0 items-start gap-10">
              <Figure value={channels.length} label="channels" />
              <Figure value={waiting} label="videos waiting" href="/signal" accent />
            </div>
          ) : null}
        </div>

        <form
          action={search}
          className={cn('relative mt-7', first ? 'mx-auto w-full max-w-[26rem]' : 'max-w-[28rem]')}
        >
          <MagnifyingGlass
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-[1.375rem] -translate-y-1/2 text-ink-3"
          />
          <input
            ref={field}
            name="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault();
                setQuery('');
              }
            }}
            placeholder={first ? '@handle, or a channel link' : 'Find one, or add a new @handle'}
            autoComplete="off"
            spellCheck={false}
            aria-label="Find a channel"
            className={cn(
              'field h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-20',
              'text-[0.875rem] text-ink placeholder:text-ink-3',
              'transition-[border-color,box-shadow] duration-[var(--t-state)]',
              'focus:border-[var(--app-accent)] focus:shadow-[0_0_0_3px_var(--app-accent-wash)] focus:outline-none',
            )}
          />

          <span className="absolute right-2.5 top-[1.375rem] flex -translate-y-1/2 items-center gap-1.5">
            {searching ? (
              <span className="text-[0.6875rem] text-ink-3">looking…</span>
            ) : query.trim() ? (
              <>
                <kbd className="pointer-events-none rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3">
                  ↵
                </kbd>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    field.current?.focus();
                  }}
                  aria-label="Clear"
                  className="flex size-6 items-center justify-center rounded-md text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink"
                >
                  <X size={12} weight="bold" />
                </button>
              </>
            ) : null}
          </span>

          {/* What the field is about to do, said before you commit to it. */}
          <AnimatePresence initial={false}>
            {!first && filter ? (
              <motion.p
                initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2 flex items-center gap-2 text-[0.75rem] text-ink-3"
              >
                <span className={cn(onShelf > 0 && 'text-[var(--app-accent)]')}>
                  {onShelf > 0
                    ? `${onShelf} on your shelf`
                    : 'nothing on your shelf matches'}
                </span>
                <span aria-hidden="true">·</span>
                <span>↵ to look for it on YouTube</span>
              </motion.p>
            ) : null}
          </AnimatePresence>
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
                className="rounded-md border border-line px-2 py-0.5 font-mono text-[0.6875rem] text-ink-2 transition-[border-color,color,translate] duration-[var(--t-state)] hover:-translate-y-0.5 hover:border-[var(--app-accent)] hover:text-ink"
              >
                {example}
              </button>
            ))}
          </p>
        ) : null}

        {first || !filter ? (
          <p className="mt-3 max-w-[30rem] text-[0.6875rem] leading-relaxed text-ink-3">
            A handle or link resolves for one unit of YouTube&rsquo;s daily quota. Searching by words
            costs a hundred, and only a hundred of those are allowed a day.
          </p>
        ) : null}

        {state.error ? (
          <p className="mt-4 max-w-[26rem] rounded-lg border border-line bg-surface px-3 py-2 text-[0.8125rem] text-[var(--i-owe-text)]">
            {state.error}
          </p>
        ) : null}

        {addError ? (
          <p className="mt-4 max-w-[26rem] rounded-lg border border-line bg-surface px-3 py-2 text-[0.8125rem] text-[var(--i-owe-text)]">
            {addError}
          </p>
        ) : null}

        <AnimatePresence initial={false}>
          {/* Gated on there being something typed, not merely on the last
              search having found something. Without `filter` here the panel
              is a snapshot: clearing the field, or adding the very channel it
              is showing, left it exactly as it was — nothing had told this
              array that the question it was answering was no longer being
              asked. */}
          {filter && state.results.length > 0 ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn('mt-5 w-full', first ? 'max-w-[30rem]' : 'max-w-[42rem]')}
            >
              <div className="flex flex-col gap-px overflow-hidden rounded-xl border border-line bg-line text-left">
                {state.results.map((result, index) => (
                  <motion.div
                    key={result.youtubeId}
                    initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.2 }}
                    className="group/result flex items-center gap-3 bg-surface px-3.5 py-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2"
                  >
                    {atSize(result.thumbnailUrl, 88) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={atSize(result.thumbnailUrl, 88) ?? undefined}
                        alt=""
                        loading="lazy"
                        className="size-10 shrink-0 rounded-full object-cover ring-1 ring-line"
                      />
                    ) : (
                      <span className="size-10 shrink-0 rounded-full bg-surface-2" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9375rem] font-medium text-ink">
                        {result.title}
                      </p>
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
                          'flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5',
                          'text-[0.8125rem] font-medium text-[var(--app-accent)]',
                          'transition-colors duration-[var(--t-state)] hover:bg-[var(--app-accent-wash)]',
                          'disabled:opacity-60',
                        )}
                      >
                        {adding === result.youtubeId ? 'Adding…' : 'Add'}
                        <ArrowRight
                          size={12}
                          weight="bold"
                          className="transition-transform duration-[var(--t-hover)] group-hover/result:translate-x-0.5"
                        />
                      </button>
                    )}
                  </motion.div>
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
                  onKeyDown={(event) => event.key === 'Escape' && setNaming(false)}
                  className="field h-9 w-[13rem] rounded-lg border border-[var(--app-accent)] bg-surface px-2.5 text-[0.8125rem] text-ink placeholder:text-ink-3 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-ink px-3 py-2 text-[0.75rem] font-medium text-ink-invert"
                >
                  Create
                </button>
              </form>
            ) : (
              <Shelf onClick={() => setNaming(true)} icon={<Plus size={13} weight="bold" />}>
                New group
              </Shelf>
            )}

            <Shelf
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
              icon={
                <Sparkle
                  size={13}
                  weight={sorting ? 'fill' : 'regular'}
                  className={cn(sorting && 'animate-[spin_1.6s_linear_infinite]')}
                />
              }
            >
              {sorting ? 'Sorting…' : 'Sort them for me'}
            </Shelf>

            <span className="flex-1" />

            <Shelf
              onClick={() => setFold({ at: Date.now(), folded: !fold?.folded })}
              icon={
                fold?.folded ? (
                  <ArrowsOutLineVertical size={13} />
                ) : (
                  <ArrowsInLineVertical size={13} />
                )
              }
            >
              {fold?.folded ? 'Open all' : 'Fold all'}
            </Shelf>

            {/* Which of the two shelves you are looking at. A segment rather
                than a menu, because there are two of them and both fit. */}
            <div
              role="group"
              aria-label="Shelf layout"
              className="flex items-center gap-0.5 rounded-lg border border-line p-0.5"
            >
              <View active={view === 'faces'} onClick={() => writeView('faces')} label="Faces">
                <SquaresFour size={14} weight={view === 'faces' ? 'fill' : 'regular'} />
              </View>
              <View active={view === 'rows'} onClick={() => writeView('rows')} label="Details">
                <ListBullets size={14} weight={view === 'rows' ? 'bold' : 'regular'} />
              </View>
            </div>
          </div>

          <ChannelBoard groups={grouped} filter={filter} view={view} collapsedAll={fold} />
        </>
      ) : null}

      {added ? (
        <ChannelAddedDialog
          key={added.channelId ?? undefined}
          open={added !== null}
          onOpenChange={(open) => !open && setAdded(null)}
          title={added.title ?? 'Channel'}
          channelId={added.channelId!}
          category={added.category}
          usedModel={added.usedModel}
          wasNew={added.wasNew}
          categories={categories}
        />
      ) : null}
    </div>
  );
}

/** One of the shelf-level actions. Quiet at rest, lifts under the pointer. */
function Shelf({
  children,
  icon,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[0.8125rem] text-ink-2',
        'transition-[border-color,color,translate,background-color] duration-[var(--t-state)] ease-[var(--ease-spring)]',
        'hover:-translate-y-0.5 hover:border-[var(--app-accent)] hover:bg-surface hover:text-ink',
        'disabled:translate-y-0 disabled:opacity-60',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** One half of the layout segment. The chosen one takes the ink, not a border. */
function View({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex size-7 items-center justify-center rounded-[6px]',
        'transition-colors duration-[var(--t-state)]',
        active ? 'bg-ink text-ink-invert' : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

/**
 * One figure, with the word for what it counts directly underneath.
 *
 * Not a `<dt>` in tiny uppercase over a bare number, which is the shape every
 * admin dashboard uses and which requires the reader to already know what
 * "Quiet" or "Reach" was supposed to mean. Here the label is the sentence
 * fragment you would say out loud — "thirty-eight channels", "two videos
 * waiting" — so there is nothing left to work out.
 *
 * The waiting one is a link, because a number telling you something is waiting
 * should be the way to go and look at it.
 */
function Figure({
  value,
  label,
  href,
  accent,
}: {
  value: number;
  label: string;
  href?: Route;
  accent?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const shown = useCountUp(value, !reduceMotion);
  const live = accent && value > 0;

  const body = (
    <>
      <span
        className={cn(
          'signal-meta block text-[2.5rem] leading-none tabular-nums',
          live ? 'text-[var(--app-accent)]' : 'text-ink',
        )}
      >
        {shown}
      </span>
      <span className="mt-1.5 block text-[0.8125rem] text-ink-3">
        {label}
        {href && live ? (
          <ArrowRight
            size={11}
            weight="bold"
            className="ml-1 inline transition-transform duration-[var(--t-hover)] group-hover/figure:translate-x-1"
          />
        ) : null}
      </span>
    </>
  );

  if (!href || !live) return <div>{body}</div>;

  return (
    <Link href={href} className="group/figure block">
      {body}
    </Link>
  );
}

