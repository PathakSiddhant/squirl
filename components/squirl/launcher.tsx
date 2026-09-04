'use client';

import { Rows } from '@phosphor-icons/react/dist/csr/Rows';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { signOut } from '@/app/actions/session';

import { Lockup } from '@/components/brand/logo';

import { AppTile } from './app-tile';
import { CommandPalette } from './command-palette';
import { ConsolePanel } from './console-panel';
import { Dock } from './dock';
import { IconGrid } from './icon-grid';
import type { LauncherApp } from './launcher-app';
import { Orbit } from './orbit';
import { StatusBar } from './status-bar';
import { StorageSheet, type StorageFacts } from './storage-sheet';

const VIEWS = [
  { id: 'cards', label: 'Cards', Icon: Rows, blurb: 'What each one has to report' },
  { id: 'icons', label: 'Icons', Icon: SquaresFour, blurb: 'Marks and names, nothing else' },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];

const STORED_VIEW = 'squirl-launcher-view';
const STORED_ORDER = 'squirl-app-order';

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
  phase,
}: {
  apps: LauncherApp[];
  storage: StorageFacts | null;
  greeting: string;
  date: string;
  phase: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<ViewId>('cards');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  // One application at a time can be the subject, and both the orbit and the
  // tiles answer to it. Pointing at a node lights its tile and pointing at a
  // tile lights its node, which is what turns two separate pictures of the
  // same three things into one.
  const [focused, setFocused] = useState<string | null>(null);
  // The order the applications are kept in, which is the reader's business
  // rather than the registry's. Held as ids so an application that is removed
  // simply drops out and a new one appends.
  const [order, setOrder] = useState<string[] | null>(null);
  const [carried, setCarried] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [orbit, setOrbit] = useState(210);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const stored = localStorage.getItem(STORED_VIEW) as ViewId | null;
    if (stored && VIEWS.some((entry) => entry.id === stored)) setView(stored);
    setTheme((localStorage.getItem('squirl-theme') as 'light' | 'dark' | 'system') ?? 'system');

    const storedOrder = localStorage.getItem(STORED_ORDER);
    if (storedOrder) {
      try {
        const parsed: unknown = JSON.parse(storedOrder);
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
          setOrder(parsed as string[]);
        }
      } catch {
        // A corrupt preference is not worth a broken launcher.
      }
    }
  }, []);

  // The orbit is the one element here that can afford to give up room, so it
  // is what shrinks on a short window rather than the applications.
  useEffect(() => {
    const fit = () => {
      const height = window.innerHeight;
      setOrbit(height < 700 ? 330 : height < 800 ? 380 : height < 900 ? 430 : 470);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  /*
    Digits open applications.

    The fastest thing a launcher can be is one keystroke, and the numbers are
    already implied by the row: the first tile is the first application. Held
    to plain digits with no modifier, and ignored while a field or the palette
    has focus, so typing a 1 into a search box never launches anything.
  */
  useEffect(() => {
    const onDigit = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0) return;
      const app = arranged[index];
      if (app?.href) {
        event.preventDefault();
        router.push(app.href);
      }
    };
    window.addEventListener('keydown', onDigit);
    return () => window.removeEventListener('keydown', onDigit);
  });

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

  /*
    Applications in the reader's own order.

    Sorted by the stored list, with anything the list has not heard of kept in
    registry order at the end. That way installing a fourth application adds it
    without disturbing the three you have already arranged, and clearing the
    preference falls back to the registry rather than to nothing.
  */
  const arranged = order
    ? [...apps].sort((a, b) => {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);
        return (ai === -1 ? apps.length : ai) - (bi === -1 ? apps.length : bi);
      })
    : apps;

  const carry = (id: string | null) => setCarried(id);

  const dropOn = (movedId: string, targetId: string) => {
    const moved = movedId || carried;
    setCarried(null);
    if (!moved || moved === targetId) return;
    const ids = arranged.map((app) => app.id);
    const from = ids.indexOf(moved);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setOrder(ids);
    localStorage.setItem(STORED_ORDER, JSON.stringify(ids));
  };

  const chooseTheme = (next: 'light' | 'dark' | 'system') => {
    setTheme(next);
    localStorage.setItem('squirl-theme', next);
  };

  return (
    <div className="flex min-h-dvh flex-col px-5 sm:px-8">
      <div className="pt-3">
        <StatusBar />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 py-2 lg:gap-[min(0.875rem,1.5vh)] lg:py-[min(0.5rem,1vh)]">
        {/*
          Three columns, and the middle one is the subject.

          Identity on the left, the system itself in the middle, and what is
          true right now on the right. The orbit had been sitting under a
          centred header, which left the brand looking wedged into the gap
          above it and the two sides of the window empty; set beside the object
          instead, the lockup anchors the composition rather than hovering over
          it, and the whole row costs the height of the orbit alone.
        */}
        <section className="flex items-center justify-between gap-6">
          <header className="rise w-[11rem] shrink-0" style={{ animationDelay: '40ms' }}>
            <Lockup size={72} alt="Squirl" className="dark:brightness-0 dark:invert" />

            <h1 className="mt-4 font-serif text-[1.5rem] font-normal leading-[1.08] tracking-[-0.02em] text-ink lg:text-[min(1.5rem,2.5vh)]">
              {greeting}.
            </h1>
            <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-3">
              {date}
              <br />
              all of it lives with <span className="text-[var(--cta)]">you.</span>
            </p>
          </header>

          <div className="rise min-w-0 flex-1" style={{ animationDelay: '180ms' }}>
            <div className="flex justify-center">
              <Orbit apps={arranged} size={orbit} focused={focused} onFocus={setFocused} />
            </div>
          </div>

          <ConsolePanel
            apps={apps.length}
            built={apps.filter((app) => app.status === 'ready').length}
            size={storage ? storage.size : 'not created'}
            written={storage ? storage.written : 'never'}
          />
        </section>

        {/* Keyed on the view, so switching re-runs the entrance rather than
            swapping contents underneath a static frame. */}
        <div
          key={view}
          className="w-full"
          style={{ animation: 'stage-in 220ms var(--ease) both' }}
        >
          {view === 'icons' ? (
            <IconGrid apps={arranged} />
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {arranged.map((app, index) => (
                <AppTile
                  key={app.id}
                  app={app}
                  snapshot={app.snapshot}
                  delay={index * 80}
                  index={index}
                  focused={focused}
                  onFocus={setFocused}
                  carried={carried}
                  onCarry={carry}
                  onDrop={dropOn}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Fixed to a wall of the window rather than sitting in the page, so it
          costs the launcher no height at all. */}
      <Dock
        view={view}
        onChooseView={(next) => choose(next as ViewId)}
        onOpenStorage={() => setStorageOpen(true)}
        onLock={() => startTransition(() => void signOut())}
        theme={theme}
        onChooseTheme={chooseTheme}
      />

      <CommandPalette
        apps={arranged}
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
