'use client';

import { Desktop } from '@phosphor-icons/react/dist/csr/Desktop';
import { Moon } from '@phosphor-icons/react/dist/csr/Moon';
import { Sun } from '@phosphor-icons/react/dist/csr/Sun';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

type Theme = 'light' | 'dark' | 'system';

const OPTIONS: Array<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Desktop },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme((localStorage.getItem('hisaab-theme') as Theme) ?? 'system');
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    localStorage.setItem('hisaab-theme', next);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = next === 'dark' || (next === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
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
