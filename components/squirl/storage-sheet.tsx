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

const KEYS = [
  {
    keys: ['Ctrl', 'K'],
    what: 'Open the command palette: applications, every screen inside them, the theme and the lock.',
  },
  {
    keys: ['Ctrl', '\\'],
    what: 'Hide the dock, and bring it back. It leaves the screen entirely rather than shrinking.',
  },
  {
    keys: ['1', '2', '3'],
    what: 'Open an application by its place in the row. The number is on its tile.',
  },
];

/**
 * Two cards on a string.
 *
 * These are two different kinds of thing. One is where the data sits, which is
 * a claim about this machine; the other is which keys do what, which is a claim
 * about this interface. Stacked in a single column they became a panel long
 * enough to need scrolling, and a modal you have to scroll is a modal that
 * should have been two.
 *
 * So they are two, tied together. The cord is not decoration for its own sake:
 * it says these are one pair rather than two windows that happened to open
 * together, and it is drawn as a real hanging curve with a knot at each end,
 * because a straight line between two boxes reads as a diagram and a slack one
 * reads as an object.
 */
export function StorageSheet({
  facts,
  children,
  open,
  onOpenChange,
}: {
  facts: StorageFacts | null;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
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

  const card = 'flex flex-col rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)]';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children ? <Dialog.Trigger asChild>{children}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay fixed inset-0 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[scrim-in_180ms_var(--ease)]" />
        <Dialog.Content
          className={cn(
            'z-modal fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-[47rem]',
            '-translate-x-1/2 -translate-y-1/2 focus:outline-none',
            'data-[state=open]:animate-[sheet-in_180ms_var(--ease)]',
          )}
        >
          <div className="flex flex-col items-stretch gap-0 lg:flex-row lg:items-stretch">
            {/* Where it lives. */}
            <section className={cn(card, 'relative flex-1')}>
              <div className="flex items-start justify-between gap-4 px-5 pt-4">
                <Dialog.Title className="text-[0.9375rem] font-semibold text-ink">
                  Where your data lives
                </Dialog.Title>
                <Dialog.Close className="-mr-1 rounded-sm p-1 text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink lg:hidden">
                  <X size={15} />
                  <span className="sr-only">Close</span>
                </Dialog.Close>
              </div>

              <Dialog.Description asChild>
                <p className="mt-3 px-5 font-serif text-[1.0625rem] leading-snug text-ink">
                  Nothing here is guessed. Every number is replayed from what you wrote down.
                </p>
              </Dialog.Description>

              <span className="ml-5 mt-4 block h-px w-10 bg-[var(--cta)]" />

              <dl className="mt-4 flex flex-1 flex-col">
                {rows.map((row, index) => (
                  <div
                    key={row.label}
                    className={cn(
                      'flex items-start gap-3 px-5 py-3',
                      index > 0 && 'border-t border-line',
                    )}
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                      <row.icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <dt className="text-[0.6875rem] text-ink-3">{row.label}</dt>
                      <dd
                        className={cn(
                          'mt-0.5 truncate text-[0.875rem] text-ink',
                          row.mono && 'font-mono text-[0.8125rem]',
                        )}
                      >
                        {row.value}
                      </dd>
                      <dd className="mt-0.5 text-[0.6875rem] leading-relaxed text-ink-3">
                        {row.note}
                      </dd>
                    </span>
                  </div>
                ))}
              </dl>

              <p className="flex items-start gap-2 rounded-b-xl border-t border-line bg-surface-2 px-5 py-3 text-[0.6875rem] leading-relaxed text-ink-3">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--in)]"
                  aria-hidden="true"
                />
                No sync, no cloud, no account. Nothing here has ever left this device.
              </p>
            </section>

            {/*
              The cord.

              Horizontal between the cards on a wide window and vertical when
              they stack, because a hanging line has to hang in the direction
              the pair is actually arranged. It sags: a straight connector reads
              as a wire in a diagram, and the slack is the whole difference
              between a diagram and a thing with weight.
            */}
            <span aria-hidden="true" className="hidden w-16 shrink-0 items-center justify-center lg:flex">
              <svg viewBox="0 0 64 40" className="h-10 w-16 overflow-visible">
                <path
                  d="M2,14 C18,34 46,34 62,14"
                  fill="none"
                  stroke="var(--line-strong)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="cord-sway"
                />
                <circle cx="2" cy="14" r="3.5" fill="var(--acorn)" />
                <circle cx="62" cy="14" r="3.5" fill="var(--acorn)" />
              </svg>
            </span>

            <span aria-hidden="true" className="flex h-10 w-full shrink-0 items-center justify-center lg:hidden">
              <svg viewBox="0 0 40 64" className="h-10 w-10 overflow-visible">
                <path
                  d="M14,2 C34,18 34,46 14,62"
                  fill="none"
                  stroke="var(--line-strong)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="14" cy="2" r="3.5" fill="var(--acorn)" />
                <circle cx="14" cy="62" r="3.5" fill="var(--acorn)" />
              </svg>
            </span>

            {/* Which keys do what. */}
            <section className={cn(card, 'relative flex-1')}>
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <h2 className="text-[0.9375rem] font-semibold text-ink">The keys</h2>
                <Dialog.Close className="-mr-1 hidden rounded-sm p-1 text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink lg:block">
                  <X size={15} />
                  <span className="sr-only">Close</span>
                </Dialog.Close>
              </div>

              <dl className="flex flex-1 flex-col">
                {KEYS.map((row, index) => (
                  <div
                    key={row.keys.join()}
                    className={cn(
                      'flex items-start gap-3 px-5 py-3',
                      index > 0 && 'border-t border-line',
                    )}
                  >
                    <dt className="flex shrink-0 items-center gap-1 pt-px">
                      {row.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded-[4px] border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-2"
                        >
                          {key}
                        </kbd>
                      ))}
                    </dt>
                    <dd className="text-[0.75rem] leading-relaxed text-ink-3">{row.what}</dd>
                  </div>
                ))}
              </dl>

              <p className="rounded-b-xl border-t border-line bg-surface-2 px-5 py-3 text-[0.6875rem] leading-relaxed text-ink-3">
                Drag the dock by its grip to any edge of the window. It settles centred on the wall
                you drop it nearest, upright on the left and right, and stays there next time.
              </p>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
