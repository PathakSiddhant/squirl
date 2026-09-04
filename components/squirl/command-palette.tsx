'use client';

import { Database } from '@phosphor-icons/react/dist/csr/Database';
import { Desktop } from '@phosphor-icons/react/dist/csr/Desktop';
import { Layout } from '@phosphor-icons/react/dist/csr/Layout';
import { LockSimple } from '@phosphor-icons/react/dist/csr/LockSimple';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Moon } from '@phosphor-icons/react/dist/csr/Moon';
import { Sun } from '@phosphor-icons/react/dist/csr/Sun';
import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Command } from 'cmdk';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { signOut } from '@/app/actions/session';
import { AppMark } from '@/components/brand/logo';
import { Icon } from '@/components/shell/icon';
import { NAV_SECTIONS } from '@/components/shell/nav-items';
import { applyTheme } from '@/components/shell/theme-toggle';
import { cn } from '@/lib/cn';

import type { LauncherApp } from './launcher-app';

/**
 * Everything in Squirl, one keystroke away.
 *
 * Summoned with Ctrl/Cmd-K and not otherwise present. An earlier version put
 * this on the page as a permanent search field, which was wrong twice over: it
 * spent the best real estate on the screen on a control you use occasionally,
 * and it implied a catalogue too big to look at. There are three applications.
 * You can see all of them. Search is the shortcut for when you already know
 * where you are going, so it stays out of the way until it is called.
 *
 * It reaches further than the launcher can: every screen inside every
 * application, not just the applications themselves. "owe" finds People
 * without you having to open Ledger first.
 */

interface Destination {
  id: string;
  label: string;
  /** Searched as well as shown, so "owe" finds People. */
  hint: string;
  group: string;
  run: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  trailing?: string;
}

export function CommandPalette({
  apps,
  open,
  onOpenChange,
  onOpenStorage,
  views,
  onChooseView,
}: {
  apps: LauncherApp[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenStorage: () => void;
  views: ReadonlyArray<{ id: string; label: string; blurb: string }>;
  onChooseView: (id: string) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [, startTransition] = useTransition();

  const close = () => {
    onOpenChange(false);
    setQuery('');
  };

  const go = (href: Route) => {
    close();
    router.push(href);
  };

  const destinations: Destination[] = [
    ...apps.map((app) => ({
      id: `app-${app.id}`,
      label: app.name,
      hint: app.tagline,
      group: 'Applications',
      icon: <AppMark name={app.mark} size={17} />,
      disabled: app.status !== 'ready' || !app.href,
      trailing: app.status === 'ready' ? undefined : 'Not built yet',
      run: () => app.href && go(app.href),
    })),
    ...NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => ({
        id: `nav-${item.href}`,
        label: item.label,
        hint: item.blurb,
        group: 'Inside Ledger',
        icon: <Icon name={item.icon} size={16} />,
        run: () => go(item.href),
      })),
    ),
    // How the shelf is drawn lives here rather than on the page. A switch
    // sitting permanently above the thing it switches is a control you look at
    // constantly and touch twice: the page keeps the choice, not the chooser.
    ...views.map((entry) => ({
      id: `view-${entry.id}`,
      label: `Show applications as ${entry.label.toLowerCase()}`,
      hint: entry.blurb,
      group: 'Squirl',
      icon: <Layout size={16} />,
      run: () => {
        onChooseView(entry.id);
        close();
      },
    })),
    {
      id: 'theme-light',
      label: 'Light theme',
      hint: 'Switch the whole product to light',
      group: 'Squirl',
      icon: <Sun size={16} />,
      run: () => {
        applyTheme('light');
        close();
      },
    },
    {
      id: 'theme-dark',
      label: 'Dark theme',
      hint: 'Switch the whole product to dark',
      group: 'Squirl',
      icon: <Moon size={16} />,
      run: () => {
        applyTheme('dark');
        close();
      },
    },
    {
      id: 'theme-system',
      label: 'System theme',
      hint: 'Follow what this machine is set to',
      group: 'Squirl',
      icon: <Desktop size={16} />,
      run: () => {
        applyTheme('system');
        close();
      },
    },
    {
      id: 'storage',
      label: 'Where your data lives',
      hint: 'The file, its size, and when it was last written',
      group: 'Squirl',
      icon: <Database size={16} />,
      run: () => {
        close();
        onOpenStorage();
      },
    },
    {
      id: 'lock',
      label: 'Lock Squirl',
      hint: 'Shut the tab behind you',
      group: 'Squirl',
      icon: <LockSimple size={16} />,
      run: () => {
        close();
        startTransition(() => {
          void signOut();
        });
      },
    },
  ];

  const groups = ['Applications', 'Inside Ledger', 'Squirl'];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay fixed inset-0 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[scrim-in_180ms_var(--ease)]" />
        <Dialog.Content
          className={cn(
            'z-modal fixed left-1/2 top-[12vh] w-[calc(100vw-2rem)] max-w-[34rem] -translate-x-1/2',
            'overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]',
            'focus:outline-none data-[state=open]:animate-[sheet-in_180ms_var(--ease)]',
          )}
        >
          <VisuallyHidden>
            <Dialog.Title>Go anywhere in Squirl</Dialog.Title>
          </VisuallyHidden>

          <Command loop className="flex flex-col">
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
              <MagnifyingGlass size={17} className="shrink-0 text-ink-3" aria-hidden="true" />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Go anywhere, or change something"
                className="h-full flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-ink-3"
              />
              <kbd className="shrink-0 rounded-[5px] border border-line px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-3">
                Esc
              </kbd>
            </div>

            <Command.List className="max-h-[min(26rem,58vh)] overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="px-3 py-8 text-center text-[0.8125rem] text-ink-3">
                Nothing here by that name.
              </Command.Empty>

              {groups.map((group) => (
                <Command.Group
                  key={group}
                  heading={group}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[0.6875rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3"
                >
                  {destinations
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <Command.Item
                        key={item.id}
                        value={`${item.label} ${item.hint}`}
                        disabled={item.disabled}
                        onSelect={item.run}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5',
                          'text-ink data-[selected=true]:bg-surface-2',
                          'data-[disabled=true]:cursor-default data-[disabled=true]:opacity-45',
                        )}
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-2">
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.875rem]">{item.label}</span>
                          <span className="block truncate text-[0.75rem] text-ink-3">
                            {item.hint}
                          </span>
                        </span>
                        {item.trailing ? (
                          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[0.6875rem] text-ink-3">
                            {item.trailing}
                          </span>
                        ) : null}
                      </Command.Item>
                    ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
