'use client';

import { Toaster } from 'sonner';

/** Toasts inherit the ink palette rather than sonner's own colours. */
export function Toasts() {
  return (
    <Toaster
      position="bottom-center"
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-center gap-3 rounded-md border border-line bg-surface px-3.5 py-3 text-[0.875rem] text-ink shadow-[var(--shadow-pop)]',
          description: 'text-ink-2',
          actionButton: 'ml-auto rounded-sm bg-ink px-2.5 py-1 text-[0.8125rem] font-medium text-ink-invert',
          cancelButton: 'ml-auto rounded-sm px-2.5 py-1 text-[0.8125rem] text-ink-2',
        },
      }}
    />
  );
}
