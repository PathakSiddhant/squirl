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
import { DotsSixVertical } from '@phosphor-icons/react/dist/csr/DotsSixVertical';
import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  deleteCategory,
  removeChannel,
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
 * Order is the reader's, so it is stored rather than derived, and it is saved
 * only when a drag finishes: persisting on every frame would put a hundred
 * writes through the database for one gesture.
 */

export interface Group {
  id: string;
  name: string;
  channels: ChannelWithCount[];
}

/** Categories are droppable containers as well as sortable items. */
const UNFILED = 'unfiled';

export function ChannelBoard({ groups: initial }: { groups: Group[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  /*
    The server owns the arrangement; this holds the reader's while they are
    moving it.
    
    An override rather than a copy kept in sync with a prop. Mirroring props
    into state means writing state during render to keep them level, which is
    how a component ends up setting state from a memo and looping forever.
    Here the local value exists only between picking something up and the
    server confirming where it landed, and `null` means "the server's version
    is correct", which it is at every other moment.
  */
  const [override, setOverride] = useState<Group[] | null>(null);
  const groups = override ?? initial;
  const [dragging, setDragging] = useState<string | null>(null);
  const [draggingGroup, setDraggingGroup] = useState<string | null>(null);

  const setGroups = (next: Group[] | ((current: Group[]) => Group[])) => {
    setOverride((current) =>
      typeof next === 'function' ? next(current ?? initial) : next,
    );
  };

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicking a face to open
    // YouTube still works and only a deliberate pull picks it up.
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

    const from = groupOf(heldId);
    const to = overId.startsWith('drop:')
      ? groups.find((group) => group.id === overId.slice(5))
      : groupOf(overId);

    if (!from || !to || from.id === to.id) return;

    setGroups((current) => {
      const source = current.find((group) => group.id === from.id);
      const target = current.find((group) => group.id === to.id);
      if (!source || !target) return current;

      const moving = source.channels.find((channel) => channel.id === heldId);
      if (!moving) return current;

      const index = target.channels.findIndex((channel) => channel.id === overId);
      const at = index === -1 ? target.channels.length : index;

      return current.map((group) => {
        if (group.id === source.id) {
          return { ...group, channels: group.channels.filter((c) => c.id !== heldId) };
        }
        if (group.id === target.id) {
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
      setGroups(next);
      start(async () => {
        await saveCategoryOrder(next.filter((g) => g.id !== UNFILED).map((g) => g.id));
        router.refresh();
        // Hand authority back once the server has the arrangement.
        setOverride(null);
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

    setGroups(reordered);

    start(async () => {
      await saveChannelOrder(
        reordered.map((g) => ({
          categoryId: g.id === UNFILED ? null : g.id,
          channelIds: g.channels.map((c) => c.id),
        })),
      );
      router.refresh();
      setOverride(null);
    });
  };

  return (
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
      // is the normal case, not the exotic one, so the window has to follow the
      // pointer. The defaults only kick in within a few pixels of the edge,
      // which is too late to notice and too small to hit.
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
        <div className="flex flex-col gap-3">
          {groups
            // Unsorted is a landing place, not a group. It shows only when
            // something is actually in it, or while a face is in the air and
            // it becomes somewhere to put that face down. An empty group
            // labelled "Unsorted" sitting under a fully sorted shelf is a
            // question the reader has to answer for no reason.
            .filter(
              (group) =>
                group.id !== UNFILED || group.channels.length > 0 || dragging !== null,
            )
            .map((group) => (
              <GroupPanel
                key={group.id}
                group={group}
                carrying={dragging !== null}
                lifted={draggingGroup === group.id}
              />
            ))}
        </div>
      </SortableContext>

      {/* What you are actually holding. Rendered above everything so it is
          never clipped by a panel it is being dragged out of. */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22,1,0.36,1)' }}>
        {active ? <Face channel={active} floating /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function GroupPanel({
  group,
  carrying,
  lifted,
}: {
  group: Group;
  carrying: boolean;
  lifted: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `group:${group.id}`,
  });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-2xl border bg-surface transition-[border-color,box-shadow] duration-[var(--t-state)]',
        isDragging || lifted
          ? 'border-[var(--app-accent)] shadow-[var(--shadow-pop)]'
          : 'border-line',
      )}
    >
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        {/* The whole group travels by its handle, so dragging a face out of it
            is never mistaken for dragging the group itself. */}
        <button
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${group.name}`}
          className="flex size-6 cursor-grab items-center justify-center rounded-md text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
        >
          <DotsSixVertical size={13} weight="bold" />
        </button>

        <h2 className="signal-label flex-1 truncate">{group.name}</h2>
        <span className="signal-meta text-[0.6875rem] text-ink-3">{group.channels.length}</span>

        {/* Unsorted is not a group the reader made, so it cannot be deleted:
            it is simply where anything without a group lives. */}
        {group.id !== UNFILED ? <GroupMenu group={group} /> : null}
      </header>

      <SortableContext
        items={group.channels.map((channel) => channel.id)}
        strategy={rectSortingStrategy}
      >
        <div
          id={`drop:${group.id}`}
          className={cn(
            'grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1 p-2',
            group.channels.length === 0 && 'min-h-[5rem] place-content-center',
          )}
        >
          {group.channels.length === 0 ? (
            <p className="col-span-full py-3 text-center text-[0.75rem] text-ink-3">
              {carrying ? 'Drop it here.' : 'Empty.'}
            </p>
          ) : (
            group.channels.map((channel) => <SortableFace key={channel.id} channel={channel} />)
          )}
        </div>
      </SortableContext>
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

  const item =
    'flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.8125rem] text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={`Options for ${group.name}`}
        className="flex size-6 items-center justify-center rounded-md text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink"
      >
        <DotsThree size={15} weight="bold" />
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

function SortableFace({ channel }: { channel: ChannelWithCount }) {
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
      <Face channel={channel} />
    </div>
  );
}

function Face({ channel, floating }: { channel: ChannelWithCount; floating?: boolean }) {
  const router = useRouter();

  /*
    Opened on a double click, not a single one.

    Every face here is something you drag, and a surface where one click both
    picks up and navigates is a surface that betrays you: the drag that started
    a pixel too late becomes a new browser tab. Double-click keeps the two
    apart, and it is the gesture people already use for opening things they can
    also move around.
  */
  const open = () => window.open(channelUrl(channel.youtubeId), '_blank', 'noopener,noreferrer');
  const [, start] = useTransition();
  const src = atSize(channel.thumbnailUrl, 128);

  const act = (run: () => Promise<unknown>) =>
    start(async () => {
      await run();
      router.refresh();
    });

  const item =
    'flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.8125rem] text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink';

  return (
    <div
      onDoubleClick={floating ? undefined : open}
      title={floating ? undefined : `${channel.title} — double-click to open on YouTube`}
      className={cn(
        'group/face relative flex cursor-grab select-none flex-col items-center rounded-xl p-2 text-center',
        'transition-colors duration-[var(--t-hover)] hover:bg-surface-2',
        floating && 'scale-105 cursor-grabbing bg-surface shadow-[var(--shadow-pop)]',
      )}
    >
      <span className="relative">
        {src ? (
          <Image
            src={src}
            alt=""
            width={48}
            height={48}
            quality={90}
            unoptimized={false}
            draggable={false}
            className={cn(
              'size-12 rounded-full object-cover ring-1 ring-line',
              'transition-[box-shadow] duration-[var(--t-hover)] group-hover/face:ring-[var(--app-accent)]',
              !channel.enabled && 'opacity-40 grayscale',
            )}
          />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-[0.875rem] font-semibold text-ink-3 ring-1 ring-line">
            {channel.title.slice(0, 1).toUpperCase()}
          </span>
        )}

        {channel.waiting > 0 ? (
          <span className="signal-meta absolute -right-1 -top-1 flex min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--app-accent)] px-1 text-[0.625rem] font-medium text-white">
            {channel.waiting}
          </span>
        ) : null}

        {channel.syncStatus === 'error' ? (
          <span
            title={channel.lastError ?? 'Could not refresh'}
            className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-[var(--i-owe)]"
          />
        ) : null}
      </span>

      <span className="mt-1.5 line-clamp-2 text-[0.625rem] leading-tight text-ink-2">
        {channel.title}
      </span>

      {!floating ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={`Options for ${channel.title}`}
            className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity duration-[var(--t-state)] hover:bg-surface-3 hover:text-ink focus:opacity-100 group-hover/face:opacity-100 data-[state=open]:opacity-100"
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
      ) : null}
    </div>
  );
}
