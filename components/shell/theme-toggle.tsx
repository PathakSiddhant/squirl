'use client';

import { Desktop } from '@phosphor-icons/react/dist/csr/Desktop';
import { Moon } from '@phosphor-icons/react/dist/csr/Moon';
import { Sun } from '@phosphor-icons/react/dist/csr/Sun';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

export type Theme = 'light' | 'dark' | 'system';

const OPTIONS: Array<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Desktop },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/**
 * Writes the resolved theme onto the document and remembers the choice.
 *
 * The choice is stored beside the resolved class because the threshold treats
 * a chosen Light differently from an OS that merely happens to be light.
 *
 * Exported because the command bar sets the theme too, and a second copy of
 * this would drift from the first.
 */
export function applyTheme(choice: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = choice === 'dark' || (choice === 'system' && prefersDark);
  localStorage.setItem('squirl-theme', choice);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = choice;
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme((localStorage.getItem('squirl-theme') as Theme) ?? 'system');
  }, []);

  // On System, follow the OS while the page is open. Without this the setting
  // means "whatever the OS said at load", and the screen stays light while the
  // machine goes dark around it.
  useEffect(() => {
    if (theme !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme('system');
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [theme]);

  const apply = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn('inline-flex items-center gap-0.5 rounded-sm border border-line bg-surface p-0.5', className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        // Before mount nothing is marked active, so the server and client agree.
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => apply(value)}
            className={cn(
              'flex size-6 items-center justify-center rounded-[4px] transition-colors duration-[var(--t-state)]',
              active ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            <Icon size={13} weight={active ? 'fill' : 'regular'} />
          </button>
        );
      })}
    </div>
  );
}
