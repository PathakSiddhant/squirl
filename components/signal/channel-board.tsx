'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { DotsSixVertical } from '@phosphor-icons/react/dist/csr/DotsSixVertical';
import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import {
  deleteCategory,
  removeChannel,
  renameCategory,
  saveCategoryOrder,
  saveChannelOrder,
  toggleChannel,
} from '@/app/actions/signal';
import { cn } from '@/lib/cn';
import type { ChannelWithCount } from '@/lib/signal/channels';
import { atSize, channelUrl } from '@/lib/signal/youtube';

/**
 * The shelf: every channel, arranged the way the reader wants it.
 *
 * Two sortable levels. Channels move within a group and between groups, and
 * the groups themselves move up and down. Everything shifts live: neighbours
 * step aside as the thing you are holding passes them, so the drop is a
 * confirmation of an arrangement you can already see rather than a guess about
 * where it will land.
 *
 * Drawn as faces rather than as rows. You do not recognise a creator by their
 * name in a table, you recognise them instantly by their avatar, which is
 * precisely what those avatars are for. Thirty-nine names in a list is a
 * spreadsheet of things you already know.
 *
 * Groups are told apart by colour rather than by rules drawn across the page.
 * A hairline between two things says only "these are different"; a colour says
 * which one you are looking at, and it survives being glanced at rather than
 * read. The hue comes from the group's own name, so it is stable without being
 * stored, and renaming a group repaints it — a fair trade for never having a
 * colour column to migrate.
 */

export interface Group {
  id: string;
  name: string;
  channels: ChannelWithCount[];
}

/** Categories are droppable containers as well as sortable items. */
const UNFILED = 'unfiled';

/**
 * Two ways to look at the same shelf.
 *
 * `faces` is for recognising: avatars at a size you read in one glance, ten to
 * a row, no words you have to actually parse. `rows` is for auditing — who has
 * how many subscribers, what is paused, what failed to refresh and when it was
 * last tried. They are genuinely different questions and a single layout that
 * tried to answer both would answer neither well.
 */
export type ShelfView = 'faces' | 'rows';

// ------------------------------------------------------- holding the order

/**
 * The arrangement, as ids only.
 *
 * Ids rather than rows, because this outlives the objects it describes: the
 * server re-sends every channel on each refresh, and an arrangement made of
 * stale copies would pin the screen to whatever the counts were at the moment
 * of the drag.
 */
interface Arrangement {
  groups: string[];
  members: Record<string, string[]>;
}

/** An arrangement, plus what the server was saying when it was made. */
interface Held {
  arrangement: Arrangement;
  basis: string;
}

function arrange(groups: Group[]): Arrangement {
  return {
    groups: groups.map((group) => group.id),
    members: Object.fromEntries(groups.map((group) => [group.id, group.channels.map((c) => c.id)])),
  };
}

/** Two arrangements are the same arrangement if they read the same. */
function signature(groups: Group[]): string {
  return groups.map((g) => `${g.id}:${g.channels.map((c) => c.id).join(',')}`).join('|');
}

/**
 * The server's data, in the reader's order.
 *
 * This is the whole answer to the snap-back. The obvious way to do optimistic
 * ordering is to hold a copy of the list, show it, ask the server to save, and
 * then drop the copy — but `router.refresh()` does not wait for the new page,
 * so dropping the copy uncovers the *old* server order for the frame or two
 * before the fresh one lands, and the thing you just moved visibly jumps back
 * and then forward again.
 *
 * So the local value is not a copy and it is never dropped on a timer. It is a
 * list of ids that the fresh server rows are poured into on every render, which
 * means new counts and new sync states arrive normally while the order stays
 * exactly where it was put. It is released only once the server independently
 * reports the same arrangement, at which point releasing it changes nothing on
 * screen by definition.
 */
function apply(server: Group[], order: Arrangement): Group[] {
  const groupById = new Map(server.map((group) => [group.id, group]));
  const channelById = new Map(server.flatMap((g) => g.channels).map((c) => [c.id, c]));
  const placed = new Set<string>();

  const ids = [
    ...order.groups.filter((id) => groupById.has(id)),
    // A group made since the drag. It has no place in the arrangement, so it
    // keeps the one the server gave it.
    ...server.map((group) => group.id).filter((id) => !order.groups.includes(id)),
  ];

  const result: Group[] = ids.map((id) => {
    const source = groupById.get(id)!;
    const channels: ChannelWithCount[] = [];
    for (const channelId of order.members[id] ?? []) {
      const channel = channelById.get(channelId);
      if (channel && !placed.has(channelId)) {
        channels.push(channel);
        placed.add(channelId);
      }
    }
    return { id, name: source.name, channels };
  });

  // Anything the server knows about that the arrangement has never seen — a
  // channel added since — lands where the server put it.
  for (const group of server) {
    for (const channel of group.channels) {
      if (placed.has(channel.id)) continue;
      const target = result.find((g) => g.id === group.id);
      if (!target) continue;
      target.channels.push(channel);
      placed.add(channel.id);
    }
  }

  return result;
}

/**
 * A stable hue for a name.
 *
 * Deliberately not random and deliberately not stored. The same word always
 * produces the same colour, on every machine and after every reload, which is
 * the only property that makes a colour worth recognising.
 */
export function hueOf(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 100_000;
  // Stepped by a number coprime with the circle, so two groups created one
  // after another never land on neighbouring shades.
  return (hash * 47) % 360;
}

/** Rounded the way people say it. */
function subs(count: number | null): string | null {
  if (count === null) return null;
  if (count >= 10_000_000) return `${Math.round(count / 1_000_000)}M`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return String(count);
}

/** "just now", "12 min ago", "3h ago". Precision nobody needs is noise. */
function ago(at: number | null): string {
  if (!at) return 'not yet';
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 90) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function matches(channel: ChannelWithCount, filter: string): boolean {
  if (!filter) return true;
  const term = filter.toLowerCase();
  return (
    channel.title.toLowerCase().includes(term) || (channel.handle ?? '').toLowerCase().includes(term)
  );
}

// ------------------------------------------------------------------ the board

export function ChannelBoard({
  groups: initial,
  filter = '',
  view = 'faces',
  collapsedAll,
}: {
  groups: Group[];
  filter?: string;
  view?: ShelfView;
  /** Bumped by the shelf's fold/unfold control; the sign says which way. */
  collapsedAll?: { at: number; folded: boolean };
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [held, setHeld] = useState<Held | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [draggingGroup, setDraggingGroup] = useState<string | null>(null);
  const [folds, setFolds] = useState<Record<string, { at: number; value: boolean }>>({});
  // The entrance runs once. Left on, every drop would replay it, because a face
  // moved between groups is a new node to React and would come in fading.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(timer);
  }, []);

  /*
    Whether the reader's arrangement still applies, worked out during render
    rather than in an effect that clears state.

    `basis` is what the server was saying at the moment the drag started. While
    it still says that, the save has not come back yet and the local
    arrangement is the one to draw. The instant the server says anything else —
    normally because our own save landed, occasionally because something like
    "sort them for me" moved things on its own — the server is the newer
    authority and the local arrangement is dropped.

    When the change is our own save arriving, dropping it is invisible: the two
    describe the same shelf. That is the whole trick, and it is why there is no
    snap-back. The old version cleared the local copy on a timer after calling
    `router.refresh()`, which does not wait for the new page — so the clear
    uncovered the *old* server order for a frame or two, and whatever had just
    been moved jumped back and then forward again.
  */
  const stale = held !== null && signature(initial) !== held.basis;
  const order = stale ? null : (held?.arrangement ?? null);
  const groups = order ? apply(initial, order) : initial;

  /** Edit the arrangement, always against the newest one. */
  const update = (fn: (current: Group[]) => Group[]) => {
    setHeld((current) => {
      const live = current && signature(initial) === current.basis ? current : null;
      return {
        basis: live?.basis ?? signature(initial),
        arrangement: arrange(fn(live ? apply(initial, live.arrangement) : initial)),
      };
    });
  };

  /** Same, for a change already worked out in full. */
  const commit = (next: Group[]) =>
    setHeld((current) => ({
      basis: current && signature(initial) === current.basis ? current.basis : signature(initial),
      arrangement: arrange(next),
    }));

  /*
    Folded groups, also derived rather than synchronised.

    Each group remembers when it was last folded by hand; the shelf-wide
    control carries when it was last pressed. Whichever happened more recently
    wins, which is what a reader means by both gestures without either having
    to reach in and overwrite the other's state.
  */
  const isCollapsed = (id: string): boolean => {
    const own = folds[id];
    if (collapsedAll && (!own || collapsedAll.at > own.at)) return collapsedAll.folded;
    return own?.value ?? false;
  };

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a double-click on a face
    // still opens YouTube and only a deliberate pull picks it up.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const allChannels = groups.flatMap((group) => group.channels);
  const active = dragging ? allChannels.find((channel) => channel.id === dragging) : null;

  const groupOf = (channelId: string) =>
    groups.find((group) => group.channels.some((channel) => channel.id === channelId));

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith('group:')) setDraggingGroup(id.slice(6));
    else setDragging(id);
  };

  /**
   * Move the held channel into whatever it is currently over.
   *
   * Done during the drag rather than at the end, because that is what makes
   * the other tiles step aside: the arrangement under the pointer is the real
   * one at every moment, and the drop only stops the music.
   */
  const onDragOver = (event: DragOverEvent) => {
    const { active: held, over } = event;
    if (!over || draggingGroup) return;

    const heldId = String(held.id);
    const overId = String(over.id);
    if (heldId === overId) return;

    update((current) => {
      const from = current.find((g) => g.channels.some((c) => c.id === heldId));
      const to = overId.startsWith('drop:')
        ? current.find((g) => g.id === overId.slice(5))
        : current.find((g) => g.channels.some((c) => c.id === overId));

      if (!from || !to || from.id === to.id) return current;

      const moving = from.channels.find((channel) => channel.id === heldId);
      if (!moving) return current;

      const index = to.channels.findIndex((channel) => channel.id === overId);
      const at = index === -1 ? to.channels.length : index;

      return current.map((group) => {
        if (group.id === from.id) {
          return { ...group, channels: group.channels.filter((c) => c.id !== heldId) };
        }
        if (group.id === to.id) {
          const next = [...group.channels];
          next.splice(at, 0, moving);
          return { ...group, channels: next };
        }
        return group;
      });
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active: held, over } = event;
    const heldId = String(held.id);

    // A group was moved.
    if (draggingGroup) {
      setDraggingGroup(null);
      if (!over) return;
      const overId = String(over.id).replace(/^group:/, '');
      const from = groups.findIndex((group) => group.id === draggingGroup);
      const to = groups.findIndex((group) => group.id === overId);
      if (from === -1 || to === -1 || from === to) return;

      const next = arrayMove(groups, from, to);
      commit(next);
      // Saved, then forgotten about. The screen is already right, and the
      // refresh only brings fresher counts.
      start(async () => {
        await saveCategoryOrder(next.filter((g) => g.id !== UNFILED).map((g) => g.id));
        router.refresh();
      });
      return;
    }

    setDragging(null);
    if (!over) return;

    const overId = String(over.id);
    const group = groupOf(heldId);
    if (!group) return;

    const reordered = (() => {
      if (heldId === overId || overId.startsWith('drop:')) return groups;
      const from = group.channels.findIndex((c) => c.id === heldId);
      const to = group.channels.findIndex((c) => c.id === overId);
      if (from === -1 || to === -1) return groups;
      return groups.map((g) =>
        g.id === group.id ? { ...g, channels: arrayMove(g.channels, from, to) } : g,
      );
    })();

    commit(reordered);

    start(async () => {
      await saveChannelOrder(
        reordered.map((g) => ({
          categoryId: g.id === UNFILED ? null : g.id,
          channelIds: g.channels.map((c) => c.id),
        })),
      );
      router.refresh();
    });
  };

  const toggleCollapse = (id: string) =>
    setFolds((current) => ({ ...current, [id]: { at: Date.now(), value: !isCollapsed(id) } }));

  const visible = groups.filter((group) => {
    // While filtering, a group with nothing in it is not a place to look.
    if (filter && !group.channels.some((channel) => matches(channel, filter))) return false;
    // Unsorted is a landing place, not a group. It shows only when something is
    // actually in it, or while a face is in the air and it becomes somewhere to
    // put that face down. An empty group labelled "Unsorted" under a fully
    // sorted shelf is a question the reader has to answer for no reason.
    return group.id !== UNFILED || group.channels.length > 0 || dragging !== null;
  });

  return (
    <Tooltip.Provider delayDuration={420} skipDelayDuration={120}>
      <DndContext
        /*
          A fixed id, so the accessibility ids dnd-kit hangs off it are the same
          on the server and in the browser. Left to generate its own, the drag
          handles come back with different `aria-describedby` values on each side
          and React reports a hydration mismatch on every load.
        */
        id="signal-shelf"
        sensors={sensors}
        collisionDetection={closestCenter}
        // Dragging a face from the bottom of a long shelf to a group at the top
        // is the normal case, not the exotic one, so the window has to follow
        // the pointer. The defaults only kick in within a few pixels of the
        // edge, which is too late to notice and too small to hit.
        autoScroll={{ threshold: { x: 0, y: 0.2 }, acceleration: 12 }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragging(null);
          setDraggingGroup(null);
        }}
      >
        <SortableContext
          items={groups.map((group) => `group:${group.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-4">
            {visible.map((group) => (
              <GroupPanel
                key={group.id}
                group={group}
                filter={filter}
                carrying={dragging !== null}
                lifted={draggingGroup === group.id}
                collapsed={isCollapsed(group.id)}
                onToggle={() => toggleCollapse(group.id)}
                stagger={!settled}
                view={view}
              />
            ))}
          </div>
        </SortableContext>

        {/* What you are actually holding. Rendered above everything so it is
            never clipped by a panel it is being dragged out of, and tipped a
            couple of degrees so it reads as picked up rather than as a copy
            lying flat on the page. */}
        <DragOverlay dropAnimation={{ duration: 190, easing: 'cubic-bezier(0.22,1,0.36,1)' }}>
          {active ? (
            view === 'rows' ? (
              <Row channel={active} floating />
            ) : (
              <Face channel={active} floating />
            )
          ) : null}
        </DragOverlay>
      </DndContext>
    </Tooltip.Provider>
  );
}

// ------------------------------------------------------------------ a group

function GroupPanel({
  group,
  filter,
  carrying,
  lifted,
  collapsed,
  onToggle,
  stagger,
  view,
}: {
  group: Group;
  filter: string;
  carrying: boolean;
  lifted: boolean;
  collapsed: boolean;
  onToggle: () => void;
  stagger: boolean;
  view: ShelfView;
}) {
  const reduceMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `group:${group.id}`,
  });

  const hue = hueOf(group.name);
  const waiting = group.channels.reduce((total, channel) => total + channel.waiting, 0);
  const held = isDragging || lifted;

  return (
    <section
      ref={setNodeRef}
      // Named, so the summary bar above the shelf can send you here.
      id={`shelf:${group.id}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Two stops off one hue: a saturated one for the spine and the count,
        // and a barely-there wash for what it sits on.
        ['--tint' as string]: `oklch(0.66 0.15 ${hue})`,
        ['--tint-wash' as string]: `oklch(0.66 0.15 ${hue} / 0.1)`,
      }}
      className={cn(
        'group/panel relative rounded-2xl border transition-[border-color,box-shadow,background-color] duration-[var(--t-state)]',
        held
          ? 'z-raised border-[var(--tint)] bg-surface shadow-[var(--shadow-pop)]'
          : 'border-transparent hover:border-line hover:bg-surface',
      )}
    >
      <header className="flex items-center gap-2.5 px-3 pb-1 pt-3.5">
        {/* The whole group travels by its handle, so dragging a face out of it
            is never mistaken for dragging the group itself. */}
        <button
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${group.name}`}
          className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-ink-3 opacity-0 transition-[opacity,background-color,color] duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover/panel:opacity-100 active:cursor-grabbing"
        >
          <DotsSixVertical size={15} weight="bold" />
        </button>

        {/* The spine. It is the group's colour and it is also the collapse
            control, because a coloured bar beside a heading is the thing the
            hand goes to anyway. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Open ${group.name}` : `Collapse ${group.name}`}
          className="flex shrink-0 items-center gap-2"
        >
          <span
            className={cn(
              'block w-[3px] rounded-full bg-[var(--tint)] transition-[height,opacity] duration-[var(--t-hover)] ease-[var(--ease-spring)]',
              collapsed ? 'h-3.5 opacity-60' : 'h-5 opacity-100',
            )}
          />
          <CaretRight
            size={12}
            weight="bold"
            className={cn(
              'text-ink-3 transition-[rotate,opacity] duration-[var(--t-state)]',
              collapsed
                ? 'rotate-0 opacity-100'
                : 'rotate-90 opacity-0 group-hover/panel:opacity-100',
            )}
          />
        </button>

        <h2 className="min-w-0 flex-1 truncate font-serif text-[1.375rem] font-normal tracking-[-0.02em] text-ink">
          {group.name}
        </h2>

        {/* Two numbers saying different things: how much is on this shelf, and
            how much of it is asking for you. */}
        <span className="signal-meta shrink-0 text-[0.8125rem] tabular-nums text-ink-3">
          {group.channels.length}
        </span>

        <AnimatePresence initial={false}>
          {waiting > 0 ? (
            <motion.span
              initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 620, damping: 26 }}
              className="signal-meta shrink-0 rounded-full bg-[var(--tint-wash)] px-2 py-0.5 text-[0.75rem] font-semibold tabular-nums text-[var(--tint)]"
            >
              {waiting} waiting
            </motion.span>
          ) : null}
        </AnimatePresence>

        {/* Unsorted is not a group the reader made, so it cannot be renamed or
            deleted: it is simply where anything without a group lives. */}
        {group.id !== UNFILED ? <GroupMenu group={group} /> : null}
      </header>

      <AnimatePresence initial={false} mode="wait">
        {collapsed ? (
          <motion.button
            key="stack"
            type="button"
            onClick={onToggle}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="flex w-full items-center gap-3 px-4 pb-4 pt-1 text-left"
          >
            {/* Folded away, not hidden. The faces overlap into a stack, so a
                closed group still says who is in it. */}
            <span className="flex items-center">
              {group.channels.slice(0, 10).map((channel, index) => {
                const src = atSize(channel.thumbnailUrl, 88);
                return (
                  <span
                    key={channel.id}
                    style={{ marginLeft: index === 0 ? 0 : '-0.5rem', zIndex: 10 - index }}
                    className="relative block size-8 rounded-full ring-2 ring-bg"
                  >
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        width={32}
                        height={32}
                        quality={90}
                        draggable={false}
                        className="size-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="block size-8 rounded-full bg-surface-2" />
                    )}
                  </span>
                );
              })}
            </span>
            {group.channels.length > 10 ? (
              <span className="signal-meta text-[0.75rem] text-ink-3">
                +{group.channels.length - 10}
              </span>
            ) : null}
          </motion.button>
        ) : (
          <motion.div
            key="grid"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <SortableContext
              items={group.channels.map((channel) => channel.id)}
              strategy={view === 'rows' ? verticalListSortingStrategy : rectSortingStrategy}
            >
              <div
                id={`drop:${group.id}`}
                className={cn(
                  view === 'rows'
                    ? 'flex flex-col p-1.5'
                    : 'grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-0.5 p-2',
                  group.channels.length === 0 && 'min-h-[6rem] place-content-center',
                )}
              >
                {group.channels.length === 0 ? (
                  <p
                    className={cn(
                      'col-span-full rounded-xl border border-dashed py-7 text-center text-[0.8125rem] transition-colors duration-[var(--t-state)]',
                      carrying
                        ? 'border-[var(--tint)] bg-[var(--tint-wash)] text-[var(--tint)]'
                        : 'border-line text-ink-3',
                    )}
                  >
                    {carrying ? 'Drop it here.' : 'Empty. Drag a face in.'}
                  </p>
                ) : (
                  group.channels.map((channel, index) => (
                    <SortableFace
                      key={channel.id}
                      channel={channel}
                      index={index}
                      dimmed={!matches(channel, filter)}
                      stagger={stagger}
                      view={view}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * What can be done to a group itself.
 *
 * Deleting one never deletes channels. They fall back to Unsorted, which is
 * the only behaviour that makes the action safe to use: a reader tidying their
 * shelf must never discover that tidying threw away what was on it.
 */
function GroupMenu({ group }: { group: Group }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [renaming, setRenaming] = useState(false);

  const item =
    'flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.8125rem] text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink';

  if (renaming) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const name = new FormData(event.currentTarget).get('name');
          setRenaming(false);
          if (typeof name !== 'string' || !name.trim()) return;
          start(async () => {
            await renameCategory(group.id, name);
            router.refresh();
          });
        }}
      >
        <input
          name="name"
          autoFocus
          defaultValue={group.name}
          maxLength={32}
          onBlur={() => setRenaming(false)}
          onKeyDown={(event) => event.key === 'Escape' && setRenaming(false)}
          aria-label={`Rename ${group.name}`}
          className="field h-8 w-[11rem] rounded-lg border border-[var(--tint)] bg-surface px-2.5 text-[0.8125rem] text-ink focus:outline-none"
        />
      </form>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={`Options for ${group.name}`}
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-3 opacity-0 transition-[opacity,background-color,color] duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover/panel:opacity-100 data-[state=open]:opacity-100"
      >
        <DotsThree size={16} weight="bold" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-dropdown min-w-[13rem] rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)] data-[state=open]:animate-[sheet-in_140ms_var(--ease)]"
        >
          <DropdownMenu.Label className="px-2.5 pb-1 pt-0.5 text-[0.625rem] uppercase tracking-[0.08em] text-ink-3">
            {group.name}
          </DropdownMenu.Label>

          <DropdownMenu.Item className={item} onSelect={() => setRenaming(true)}>
            <PencilSimple size={14} />
            Rename
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={cn(
              item,
              'data-[highlighted]:bg-[var(--i-owe-wash)] data-[highlighted]:text-[var(--i-owe-text)]',
            )}
            onSelect={() =>
              start(async () => {
                await deleteCategory(group.id);
                router.refresh();
              })
            }
          >
            <Trash size={14} />
            Delete group
          </DropdownMenu.Item>

          <p className="px-2.5 pb-1 pt-1.5 text-[0.625rem] leading-relaxed text-ink-3">
            {group.channels.length > 0
              ? `The ${group.channels.length} channels in it move to Unsorted. Nothing is unfollowed.`
              : 'Nothing is in it.'}
          </p>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ------------------------------------------------------------------- a face

function SortableFace({
  channel,
  index,
  dimmed,
  stagger,
  view,
}: {
  channel: ChannelWithCount;
  index: number;
  dimmed: boolean;
  stagger: boolean;
  view: ShelfView;
}) {
  const reduceMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: channel.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('touch-none', isDragging && 'opacity-30')}
    >
      {/* Arrives rather than appears, and only on the first paint. The stagger
          is small enough that a shelf of forty is settled inside half a second,
          which is the difference between a page assembling itself and one
          showing off. */}
      <motion.div
        initial={reduceMotion || !stagger ? false : { opacity: 0, y: 8, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          delay: Math.min(index, 14) * 0.018,
          duration: 0.26,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {view === 'rows' ? (
          <Row channel={channel} dimmed={dimmed} />
        ) : (
          <Face channel={channel} dimmed={dimmed} />
        )}
      </motion.div>
    </div>
  );
}

function Face({
  channel,
  floating,
  dimmed,
}: {
  channel: ChannelWithCount;
  floating?: boolean;
  dimmed?: boolean;
}) {
  /*
    Opened on a double click, not a single one.

    Every face here is something you drag, and a surface where one click both
    picks up and navigates is a surface that betrays you: the drag that started
    a pixel too late becomes a new browser tab. Double-click keeps the two
    apart, and it is the gesture people already use for opening things they can
    also move around.
  */
  const open = () => window.open(channelUrl(channel.youtubeId), '_blank', 'noopener,noreferrer');
  const src = atSize(channel.thumbnailUrl, 160);

  const face = (
    <div
      onDoubleClick={floating ? undefined : open}
      className={cn(
        'group/face relative flex cursor-grab select-none flex-col items-center rounded-xl p-2.5 text-center',
        'transition-[background-color,translate,opacity,filter] duration-[var(--t-hover)] ease-[var(--ease-spring)]',
        !floating && 'hover:-translate-y-1 hover:bg-surface-2 active:translate-y-0',
        // Filtered out, not removed. Faces keep their places, so the shelf you
        // know does not rearrange itself the moment you start typing.
        dimmed && 'opacity-25 grayscale',
        floating && 'rotate-[-3deg] scale-105 cursor-grabbing bg-surface shadow-[var(--shadow-pop)]',
      )}
    >
      <span className="relative">
        {/* A slow halo, only on the ones with something waiting. It is the
            single moving thing on a still shelf, so it is where the eye goes. */}
        {channel.waiting > 0 && !floating ? (
          <span className="absolute -inset-1 animate-[pulse_2.8s_var(--ease)_infinite] rounded-full bg-[var(--app-accent-wash)]" />
        ) : null}

        {src ? (
          <Image
            src={src}
            alt=""
            width={64}
            height={64}
            quality={90}
            unoptimized={false}
            draggable={false}
            className={cn(
              'relative size-16 rounded-full object-cover ring-1 ring-line',
              'transition-[box-shadow] duration-[var(--t-hover)] group-hover/face:ring-2 group-hover/face:ring-[var(--app-accent)]',
              !channel.enabled && 'opacity-40 grayscale',
            )}
          />
        ) : (
          <span className="relative flex size-16 items-center justify-center rounded-full bg-surface-2 text-[1.125rem] font-semibold text-ink-3 ring-1 ring-line">
            {channel.title.slice(0, 1).toUpperCase()}
          </span>
        )}

        {channel.waiting > 0 ? (
          <span className="signal-meta absolute -right-1 -top-1 flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--app-accent)] px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-white shadow-[var(--shadow-pop)]">
            {channel.waiting}
          </span>
        ) : null}

        {channel.syncStatus === 'error' ? (
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-[var(--i-owe)]" />
        ) : null}

        {!channel.enabled ? (
          <span className="signal-meta absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-surface-3 px-1.5 text-[0.5625rem] uppercase tracking-[0.08em] text-ink-3">
            paused
          </span>
        ) : null}
      </span>

      <span className="mt-2.5 line-clamp-2 text-[0.75rem] font-medium leading-tight text-ink-2">
        {channel.title}
      </span>

      {!floating ? (
        <ChannelMenu
          channel={channel}
          className="absolute right-0.5 top-0.5 size-5 opacity-0 group-hover/face:opacity-100"
        />
      ) : null}
    </div>
  );

  if (floating) return face;

  /*
    The card that appears if you rest on a face.

    Everything it says is something the grid cannot: the handle, the size of the
    audience, when this was last checked, what went wrong if anything did. A
    title attribute would carry none of it, and putting any of it under every
    avatar would turn a shelf you can scan into a table you have to read.
  */
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{face}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className="z-tooltip max-w-[17rem] rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-pop)] data-[state=delayed-open]:animate-[sheet-in_120ms_var(--ease)]"
        >
          <p className="text-[0.875rem] font-medium leading-snug text-ink">{channel.title}</p>

          <p className="signal-meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] text-ink-3">
            {channel.handle ? <span>@{channel.handle}</span> : null}
            {subs(channel.subscriberCount) ? (
              <span>{subs(channel.subscriberCount)} subs</span>
            ) : null}
            <span>checked {ago(channel.lastSyncedAt)}</span>
          </p>

          {channel.waiting > 0 ? (
            <p className="mt-2 text-[0.75rem] text-[var(--app-accent)]">
              {channel.waiting} waiting in your inbox
            </p>
          ) : null}

          {channel.syncStatus === 'error' && channel.lastError ? (
            <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--i-owe-text)]">
              {channel.lastError}
            </p>
          ) : null}

          <p className="mt-2 text-[0.6875rem] text-ink-3">Double-click to open on YouTube.</p>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/**
 * The same channel, read rather than recognised.
 *
 * Everything the tile hides behind a hover is on the line here: the handle, the
 * audience, when it was last checked, whether it is paused or failing. This is
 * the layout for the ten minutes a month spent tidying, and the faces are the
 * layout for every other time.
 */
function Row({
  channel,
  floating,
  dimmed,
}: {
  channel: ChannelWithCount;
  floating?: boolean;
  dimmed?: boolean;
}) {
  const open = () => window.open(channelUrl(channel.youtubeId), '_blank', 'noopener,noreferrer');
  const src = atSize(channel.thumbnailUrl, 96);

  return (
    <div
      onDoubleClick={floating ? undefined : open}
      title={floating ? undefined : 'Double-click to open on YouTube'}
      className={cn(
        'group/row relative flex cursor-grab select-none items-center gap-3 rounded-xl px-2.5 py-2',
        'transition-[background-color,opacity,filter] duration-[var(--t-state)]',
        !floating && 'hover:bg-surface-2',
        dimmed && 'opacity-25 grayscale',
        floating && 'w-[30rem] cursor-grabbing bg-surface shadow-[var(--shadow-pop)]',
      )}
    >
      {/* No separators between rows. Forty hairlines drawn across a panel is a
          table pretending to be a list; the hover band already says which row
          the pointer is on, and that is the only row that needs saying. */}
      <DotsSixVertical
        size={13}
        weight="bold"
        aria-hidden="true"
        className="shrink-0 text-ink-3 opacity-0 transition-opacity duration-[var(--t-state)] group-hover/row:opacity-60"
      />

      <span className="relative shrink-0">
        {src ? (
          <Image
            src={src}
            alt=""
            width={38}
            height={38}
            quality={90}
            draggable={false}
            className={cn(
              'size-[38px] rounded-full object-cover ring-1 ring-line',
              !channel.enabled && 'opacity-40 grayscale',
            )}
          />
        ) : (
          <span className="flex size-[38px] items-center justify-center rounded-full bg-surface-2 text-[0.875rem] font-semibold text-ink-3 ring-1 ring-line">
            {channel.title.slice(0, 1).toUpperCase()}
          </span>
        )}
        {channel.syncStatus === 'error' ? (
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-[var(--i-owe)]" />
        ) : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium leading-tight text-ink">
          {channel.title}
        </span>
        <span className="signal-meta mt-0.5 flex items-center gap-2 text-[0.6875rem] text-ink-3">
          {channel.handle ? <span className="truncate">@{channel.handle}</span> : null}
          {subs(channel.subscriberCount) ? <span>{subs(channel.subscriberCount)}</span> : null}
          {!channel.enabled ? <span className="uppercase tracking-[0.08em]">paused</span> : null}
        </span>
      </span>

      {channel.waiting > 0 ? (
        <span className="signal-meta shrink-0 rounded-full bg-[var(--app-accent-wash)] px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-[var(--app-accent)]">
          {channel.waiting}
        </span>
      ) : (
        <span className="w-7 shrink-0" />
      )}

      {!floating ? (
        <>
          <a
            href={channelUrl(channel.youtubeId)}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={`Open ${channel.title} on YouTube`}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-3 opacity-0 transition-[opacity,background-color,color] duration-[var(--t-state)] hover:bg-surface-3 hover:text-ink group-hover/row:opacity-100"
          >
            <ArrowUpRight size={14} weight="bold" />
          </a>
          <ChannelMenu
            channel={channel}
            className="size-7 shrink-0 opacity-0 group-hover/row:opacity-100"
          />
        </>
      ) : null}
    </div>
  );
}

/**
 * What can be done to one channel. Shared by both layouts, because the answer
 * does not depend on how the channel happens to be drawn.
 */
function ChannelMenu({ channel, className }: { channel: ChannelWithCount; className?: string }) {
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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={`Options for ${channel.title}`}
        className={cn(
          'flex items-center justify-center rounded-md text-ink-3',
          'transition-[opacity,background-color,color] duration-[var(--t-state)]',
          'hover:bg-surface-3 hover:text-ink focus:opacity-100 data-[state=open]:opacity-100',
          className,
        )}
      >
        <DotsThree size={14} weight="bold" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-dropdown min-w-[12rem] rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)] data-[state=open]:animate-[sheet-in_140ms_var(--ease)]"
        >
          <DropdownMenu.Item asChild className={item}>
            <a href={channelUrl(channel.youtubeId)} target="_blank" rel="noopener noreferrer">
              <ArrowSquareOut size={14} />
              Open on YouTube
            </a>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={item}
            onSelect={() => act(() => toggleChannel(channel.id, !channel.enabled))}
          >
            {channel.enabled ? 'Pause syncing' : 'Resume syncing'}
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-line" />

          <DropdownMenu.Item
            className={cn(
              item,
              'data-[highlighted]:bg-[var(--i-owe-wash)] data-[highlighted]:text-[var(--i-owe-text)]',
            )}
            onSelect={() => act(() => removeChannel(channel.id))}
          >
            Remove, with its content
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
