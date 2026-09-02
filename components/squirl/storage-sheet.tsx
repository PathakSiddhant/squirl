'use client';

import { ClockCounterClockwise } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise';
import { Database } from '@phosphor-icons/react/dist/csr/Database';
import { HardDrives } from '@phosphor-icons/react/dist/csr/HardDrives';
import { X } from '@phosphor-icons/react/dist/csr/X';
import * as Dialog from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';

export interface StorageFacts {
  size: string;
  written: string;
}

/**
 * Where the data lives, on demand.
 *
 * This used to be a full-width card under the application cards, which meant
 * the launcher could not be read without scrolling: the one screen whose whole
 * job is "here is everything you have" did not fit on a screen. These are
 * reference facts. You want them available and checkable, not occupying the
 * bottom third of the page every time you open the app.
 *
 * So the claim stays permanently visible on the rail, where it always was, and
 * the evidence for it opens from that same claim. That is the point of the
 * arrangement: the sentence you are asked to trust is the control that proves
 * itself, rather than a badge with the proof parked somewhere else.
 *
 * Centred, not anchored to the rail. A panel hung off a control in the bottom
 * left corner has to open across the application cards, and it reads as
 * something that got loose rather than something that was opened: pinned to
 * the edge of the window, half over the thing you were just looking at. The
 * middle of the screen, over a dimmed page, is the honest shape for a panel
 * that is asking for your full attention for two seconds.
 */
export function StorageSheet({
  facts,
  children,
}: {
  facts: StorageFacts | null;
  children: React.ReactNode;
}) {
  const rows = [
    {
      icon: Database,
      label: 'Where it lives',
      value: 'data/squirl.db',
      note: 'On this machine, nowhere else',
      mono: true,
    },
    {
      icon: HardDrives,
      label: 'Size on disk',
      value: facts ? facts.size : 'not created yet',
      note: 'Everything, across every application',
      mono: false,
    },
    {
      icon: ClockCounterClockwise,
      label: 'Last written',
      value: facts ? facts.written : 'never',
      note: 'Copy the file and you have a backup',
      mono: false,
    },
  ];

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay fixed inset-0 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[scrim-in_180ms_var(--ease)]" />
        <Dialog.Content
          className={cn(
            'z-modal fixed left-1/2 top-1/2 max-h-[88dvh] w-[calc(100vw-2rem)] max-w-[26.5rem]',
            '-translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface',
            'shadow-[var(--shadow-pop)] focus:outline-none',
            'data-[state=open]:animate-[sheet-in_180ms_var(--ease)]',
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5">
            <Dialog.Title className="text-[0.9375rem] font-semibold text-ink">
              Where your data lives
            </Dialog.Title>
            <Dialog.Close className="-mr-1 rounded-sm p-1 text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink">
              <X size={15} />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          {/* The claim first, in the display face, because it is the reason the
              rest of the panel is worth reading. */}
          <Dialog.Description asChild>
            <p className="mt-4 px-6 font-serif text-[1.125rem] leading-snug text-ink">
              Nothing here is guessed. Every number is replayed from what you wrote down.
            </p>
          </Dialog.Description>

          <span className="ml-6 mt-5 block h-px w-10 bg-[var(--cta)]" />

          <dl className="mt-5 flex flex-col">
            {rows.map((row, index) => (
              <div
                key={row.label}
                className={cn(
                  'flex items-start gap-3.5 px-6 py-3.5',
                  index > 0 && 'border-t border-line',
                )}
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                  <row.icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <dt className="text-[0.75rem] text-ink-3">{row.label}</dt>
                  <dd
                    className={cn(
                      'mt-1 truncate text-[0.9375rem] text-ink',
                      row.mono && 'font-mono text-[0.8125rem]',
                    )}
                  >
                    {row.value}
                  </dd>
                  <dd className="mt-1 text-[0.75rem] leading-relaxed text-ink-3">{row.note}</dd>
                </span>
              </div>
            ))}
          </dl>

          <p className="flex items-start gap-2 border-t border-line bg-surface-2 px-6 py-3.5 text-[0.75rem] leading-relaxed text-ink-3">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--in)]" aria-hidden="true" />
            No sync, no cloud, no account. Nothing here has ever left this device.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
