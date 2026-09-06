'use client';

import { CaretUpDown } from '@phosphor-icons/react/dist/csr/CaretUpDown';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { X } from '@phosphor-icons/react/dist/csr/X';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { recategoriseChannel } from '@/app/actions/signal';
import { cn } from '@/lib/cn';

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

/**
 * What happened when a channel was just added, and a place to correct it.
 *
 * Appears once, right after the add completes, because that is the one moment
 * the reader is already looking at exactly this decision. Filing a channel
 * silently and leaving them to notice the category was wrong three scrolls
 * later on the Channels shelf is a worse version of the same feature: the same
 * correction, paid for with a second trip back to find out it was needed.
 *
 * The category shown here is not a suggestion waiting for confirmation — the
 * channel is already filed there, and closing this without touching anything
 * changes nothing. It exists to make that placement visible and to make
 * correcting it cost one click instead of a trip to the shelf.
 */
export function ChannelAddedDialog({
  open,
  onOpenChange,
  title,
  channelId,
  category,
  usedModel,
  wasNew,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  channelId: string;
  category: CategoryOption | null;
  usedModel: boolean;
  wasNew: boolean;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [current, setCurrent] = useState(category);

  const choose = (next: CategoryOption) => {
    setCurrent(next);
    start(async () => {
      await recategoriseChannel(channelId, next.id);
      router.refresh();
    });
  };

  const item =
    'flex cursor-default select-none items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[0.8125rem] text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay fixed inset-0 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[scrim-in_180ms_var(--ease)]" />
        <Dialog.Content
          className={cn(
            'z-modal fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-[23rem]',
            '-translate-x-1/2 -translate-y-1/2 focus:outline-none',
            'data-[state=open]:animate-[sheet-in_180ms_var(--ease)]',
          )}
        >
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-pop)]">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--in-wash)] text-[var(--in-text)]">
                <Check size={16} weight="bold" />
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <Dialog.Title className="truncate text-[0.9375rem] font-semibold text-ink">
                  {wasNew ? title : `${title} is back on`}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[0.8125rem] leading-relaxed text-ink-3">
                  {wasNew ? (
                    usedModel ? (
                      <span className="inline-flex items-center gap-1">
                        <Sparkle size={11} weight="fill" className="text-[var(--app-accent)]" />
                        Filed by Gemini, from its name and description.
                      </span>
                    ) : (
                      'Filed by keyword — no model was reachable just now.'
                    )
                  ) : (
                    'It was already on your shelf and switched off. Nothing was reclassified.'
                  )}
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Close"
                className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink"
              >
                <X size={14} />
              </Dialog.Close>
            </div>

            {/* The placement, and the one control that matters here: changing
                it. Everything above is context for why this is the answer;
                this is where the reader actually acts if it is wrong. */}
            <div className="mt-4">
              <span className="signal-label">Category</span>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  className={cn(
                    'mt-1.5 flex w-full items-center justify-between rounded-lg border border-line bg-bg px-3 py-2',
                    'text-[0.875rem] text-ink transition-colors duration-[var(--t-state)]',
                    'hover:border-[var(--app-accent)] focus:border-[var(--app-accent)] focus:outline-none',
                  )}
                >
                  {current?.name ?? 'Unsorted'}
                  <CaretUpDown size={13} className="text-ink-3" />
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="start"
                    sideOffset={4}
                    className="z-modal-menu max-h-[16rem] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)] data-[state=open]:animate-[sheet-in_140ms_var(--ease)]"
                  >
                    {categories.map((option) => (
                      <DropdownMenu.Item
                        key={option.id}
                        className={item}
                        onSelect={() => choose(option)}
                      >
                        {option.name}
                        {option.id === current?.id ? (
                          <Check size={13} weight="bold" className="text-[var(--app-accent)]" />
                        ) : null}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>

            <div className="mt-5 flex justify-end">
              <Dialog.Close className="rounded-lg bg-ink px-4 py-2 text-[0.8125rem] font-medium text-ink-invert transition-opacity duration-[var(--t-state)] hover:opacity-90">
                Done
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
