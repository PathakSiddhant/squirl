'use client';

import { ArrowLineLeft } from '@phosphor-icons/react/dist/csr/ArrowLineLeft';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import * as ContextMenu from '@radix-ui/react-context-menu';

import { cn } from '@/lib/cn';

/**
 * Right-click on an application.
 *
 * The things you can do to a tile that are not "open it" have nowhere else to
 * live. Putting them on the tile as visible buttons would put three controls on
 * every card to serve the once-a-month case of rearranging the row; hiding them
 * behind the gesture every desktop already has costs the resting screen
 * nothing.
 *
 * Deliberately short. A menu that lists everything is a menu nobody reads, so
 * this is the two things you might actually want and the way back.
 */
export function TileMenu({
  name,
  canOpen,
  onOpen,
  onFirst,
  onReset,
  children,
}: {
  name: string;
  canOpen: boolean;
  onOpen: () => void;
  onFirst: () => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  const item = cn(
    'flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5',
    'text-[0.8125rem] text-ink-2 outline-none',
    'data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink',
    'data-[disabled]:opacity-40',
  );

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className={cn(
            'z-dropdown min-w-[13rem] rounded-xl border border-line bg-surface p-1.5',
            'shadow-[var(--shadow-pop)] outline-none',
            'data-[state=open]:animate-[sheet-in_140ms_var(--ease)]',
          )}
        >
          <ContextMenu.Label className="px-2.5 pb-1.5 pt-1 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
            {name}
          </ContextMenu.Label>

          <ContextMenu.Item className={item} disabled={!canOpen} onSelect={onOpen}>
            <ArrowSquareOut size={14} />
            Open
          </ContextMenu.Item>

          <ContextMenu.Item className={item} onSelect={onFirst}>
            <ArrowLineLeft size={14} />
            Move to the front
          </ContextMenu.Item>

          <ContextMenu.Separator className="my-1 h-px bg-line" />

          <ContextMenu.Item className={item} onSelect={onReset}>
            <ArrowsClockwise size={14} />
            Reset the order
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
