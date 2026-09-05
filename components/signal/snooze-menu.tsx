'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { IST_TIME_ZONE } from '@/lib/date';
import type { QueueItem } from '@/lib/signal/queue';

/**
 * Put something down, with an end.
 *
 * Every option here returns. That is the whole difference from a watch-later
 * list: a list you add to forever becomes the backlog it was meant to solve,
 * and a postponement comes back and has to be dealt with again.
 *
 * The instants are computed in the browser because "tomorrow morning" means
 * the reader's tomorrow. A server deciding that is a server in some other
 * timezone deciding when your morning is.
 */
function options(): Array<{ label: string; hint: string; at: number }> {
  const now = new Date();

  const atHour = (days: number, hour: number) => {
    const day = new Date(now);
    day.setDate(day.getDate() + days);
    day.setHours(hour, 0, 0, 0);
    return day.getTime();
  };

  // Saturday, or next Saturday if it is already the weekend.
  const toSaturday = (6 - now.getDay() + 7) % 7 || 7;

  const format = (at: number) =>
    new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIME_ZONE,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(at);

  return [
    { label: 'Later today', at: now.getTime() + 4 * 3_600_000 },
    { label: 'Tomorrow morning', at: atHour(1, 9) },
    { label: 'This weekend', at: atHour(toSaturday, 10) },
    { label: 'Next week', at: atHour(7, 9) },
  ].map((entry) => ({ ...entry, hint: format(entry.at) }));
}

export function SnoozeMenu({
  item,
  onClose,
  onChoose,
}: {
  item: QueueItem;
  onClose: () => void;
  onChoose: (until: number) => void;
}) {
  const [choices, setChoices] = useState<ReturnType<typeof options>>([]);

  // After mount only: these depend on the current time, and rendering them on
  // the server would hydrate against a different one.
  useEffect(() => setChoices(options()), []);

  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay fixed inset-0 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[scrim-in_180ms_var(--ease)]" />
        <Dialog.Content
          className={cn(
            'z-modal fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-[22rem]',
            '-translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface',
            'shadow-[var(--shadow-pop)] focus:outline-none',
            'data-[state=open]:animate-[sheet-in_180ms_var(--ease)]',
          )}
        >
          <div className="border-b border-line px-5 py-4">
            <Dialog.Title className="text-[0.9375rem] font-semibold text-ink">
              Come back to it
            </Dialog.Title>
            <Dialog.Description className="mt-1 line-clamp-1 text-[0.75rem] text-ink-3">
              {item.title}
            </Dialog.Description>
          </div>

          <div className="flex flex-col p-1.5">
            {choices.map((choice) => (
              <button
                key={choice.label}
                type="button"
                onClick={() => onChoose(choice.at)}
                className="flex items-baseline justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors duration-[var(--t-state)] hover:bg-surface-2"
              >
                <span className="text-[0.875rem] text-ink">{choice.label}</span>
                <span className="money text-[0.6875rem] text-ink-3">{choice.hint}</span>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
