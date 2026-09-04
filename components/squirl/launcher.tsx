'use client';

import { Info } from '@phosphor-icons/react/dist/csr/Info';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { Rows } from '@phosphor-icons/react/dist/csr/Rows';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { useEffect, useState, useTransition } from 'react';

import { signOut } from '@/app/actions/session';
import { LockupRow } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { cn } from '@/lib/cn';

import { AppTile } from './app-tile';
import { CommandPalette } from './command-palette';
import { IconGrid } from './icon-grid';
import type { LauncherApp } from './launcher-app';
import { Orbit } from './orbit';
import { StorageSheet, type StorageFacts } from './storage-sheet';

const VIEWS = [
  { id: 'cards', label: 'Cards', Icon: Rows, blurb: 'What each one has to report' },
  { id: 'icons', label: 'Icons', Icon: SquaresFour, blurb: 'Marks and names, nothing else' },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];

const STORED_VIEW = 'squirl-launcher-view';

/**
 * Squirl's home.
 *
 * Centred, and nothing in any corner. The product names itself at the top, the
 * orbit turns underneath it, the applications sit in the middle of the screen
 * where they are the subject rather than a sidebar, and the controls live in
 * one slim dock along the foot.
 *
 * The dock spreads them out on purpose: the file on the left, how to draw the
 * shelf in the middle, and the theme and the lock together on the right,
 * because those two are the pair you actually reach for together. Bunching all
 * five into one cluster in a corner made a personal environment look like a
 * toolbar.
 *
 * There is no search field. Ctrl-K opens the palette, which is plenty for
 * three applications, and a permanent input would spend the best space on the
 * screen implying a catalogue too big to see.
 */
export function Launcher({
  apps,
  storage,
  greeting,
  date,
}: {
  apps: LauncherApp[];
  storage: StorageFacts | null;
  greeting: string;
  date: string;
}) {
  const [view, setView] = useState<ViewId>('cards');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [orbit, setOrbit] = useState(210);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const stored = localStorage.getItem(STORED_VIEW) as ViewId | null;
    if (stored && VIEWS.some((entry) => entry.id === stored)) setView(stored);
  }, []);

  // The orbit is the one element here that can afford to give up room, so it
  // is what shrinks on a short window rather than the applications.
  useEffect(() => {
    const fit = () => {
      const height = window.innerHeight;
      setOrbit(height < 700 ? 158 : height < 800 ? 186 : height < 900 ? 210 : 232);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((wasOpen) => !wasOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choose = (next: ViewId) => {
    setView(next);
    localStorage.setItem(STORED_VIEW, next);
  };

  const dockButton =
    'flex size-9 items-center justify-center rounded-lg text-ink-3 transition-[color,background-color,transform] duration-[var(--t-state)] hover:-translate-y-0.5 hover:bg-surface-2 hover:text-ink';

  return (
    <div className="flex min-h-dvh flex-col px-5 sm:px-8">
      <div className="flex flex-1 flex-col justify-center py-4 lg:py-[min(1.25rem,2vh)]">
        {/* Side by side, not stacked.

            Stacked, this screen could not be made to fit: the mark, the hour,
            the claim, the orbit and its caption ran to well over half the
            window before a single application had been drawn, and the only way
            to land the tiles above the fold was to shrink the orbit until it
            was a smudge. Set beside each other they cost the height of the
            taller one instead of the sum, which is what buys the orbit its
            size back. */}
        <section className="flex items-center justify-between gap-10">
          <header className="rise min-w-0" style={{ animationDelay: '40ms' }}>
            <LockupRow size={48} alt="Squirl" className="dark:brightness-0 dark:invert" />

            <h1 className="mt-4 font-serif text-[2.25rem] font-normal leading-[1.05] tracking-[-0.02em] text-ink sm:text-[2.75rem] lg:text-[min(2.75rem,4.4vh)]">
              {greeting}.
            </h1>
            <p className="mt-2 text-[0.9375rem] text-ink-2">
              {date} · all of it lives with <span className="text-[var(--cta)]">you.</span>
            </p>

            {/* The claim the product rests on, said once and left with the
                screen's own words rather than parked in the dock. */}
            <p className="mt-2.5 flex items-center gap-2 text-[0.75rem] text-ink-3">
              <span className="size-1.5 rounded-full bg-[var(--in)]" aria-hidden="true" />
              All local · no sync, no cloud, no account
            </p>
          </header>

          <div className="rise hidden shrink-0 md:block" style={{ animationDelay: '180ms' }}>
            <Orbit apps={apps} size={orbit} />
          </div>
        </section>

        {/* Keyed on the view, so switching re-runs the entrance rather than
            swapping contents underneath a static frame. */}
        <div
          key={view}
          className="mt-4 w-full lg:mt-[min(1.25rem,2vh)]"
          style={{ animation: 'stage-in 220ms var(--ease) both' }}
        >
          {view === 'icons' ? (
            <IconGrid apps={apps} />
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((app, index) => (
                <AppTile key={app.id} app={app} snapshot={app.snapshot} delay={index * 80} />
              ))}
            </div>
          )}
        </div>
      </div>

      <footer
        className="rise flex items-center justify-between gap-3 pb-4 lg:pb-[min(1.25rem,2vh)]"
        style={{ animationDelay: '520ms' }}
      >
        <button
          type="button"
          onClick={() => setStorageOpen(true)}
          title="Where your data lives"
          aria-label="Where your data lives"
          className={dockButton}
        >
          <Info size={17} />
        </button>

        <div
          role="radiogroup"
          aria-label="How to show applications"
          className="inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1"
        >
          {VIEWS.map(({ id, label, Icon, blurb }) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                title={blurb}
                aria-label={label}
                onClick={() => choose(id)}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg',
                  'transition-colors duration-[var(--t-state)]',
                  active ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:text-ink-2',
                )}
              >
                <Icon size={15} weight={active ? 'fill' : 'regular'} />
              </button>
            );
          })}
        </div>

        {/* The pair. Set the light, then shut the door. */}
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => startTransition(() => void signOut())}
            title="Lock Squirl"
            aria-label="Lock Squirl"
            className={dockButton}
          >
            <Lock size={17} />
          </button>
        </div>
      </footer>

      <CommandPalette
        apps={apps}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpenStorage={() => setStorageOpen(true)}
        views={VIEWS}
        onChooseView={(next) => choose(next as ViewId)}
      />
      <StorageSheet facts={storage} open={storageOpen} onOpenChange={setStorageOpen} />
    </div>
  );
}
