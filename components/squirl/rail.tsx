import { House } from '@phosphor-icons/react/dist/ssr/House';
import { Lock } from '@phosphor-icons/react/dist/ssr/Lock';
import Link from 'next/link';

import { signOut } from '@/app/actions/session';
import { AppMark } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { Button } from '@/components/ui/button';
import { APPS } from '@/lib/squirl/apps';

import { StorageSheet, type StorageFacts } from './storage-sheet';

/**
 * The rail down the left of Squirl's home.
 *
 * It has three jobs, and nothing on it that is not one of them: get you home,
 * get you into an application, and tell you the truth about where your data
 * is. An earlier version was two app icons and little else, which is a
 * decoration pretending to be navigation.
 *
 * The applications live here as well as on the cards on purpose. This is the
 * shortest path between them once there is more than one, and it is the same
 * shape in every application's own shell.
 */
export function Rail({ storage }: { storage: StorageFacts | null }) {
  return (
    <aside className="z-rail fixed inset-y-0 left-0 hidden w-[8.75rem] flex-col items-center border-r border-line bg-surface px-3 py-5 lg:flex">
      <Link
        href="/"
        aria-current="page"
        className="relative flex w-full flex-col items-center gap-1.5 rounded-lg bg-surface-2 py-3.5 text-ink"
      >
        <span className="absolute left-2.5 top-2.5 size-1.5 rounded-full bg-acorn" aria-hidden="true" />
        <House size={22} weight="fill" />
        <span className="text-[0.75rem] font-medium">Home</span>
      </Link>

      <span className="my-4 h-px w-9 bg-line" />

      <nav aria-label="Applications" className="flex w-full flex-col items-center gap-1">
        {APPS.map((app) => {
          const inner = (
            <>
              <span className="flex size-11 items-center justify-center rounded-lg bg-[var(--app-accent-wash)]">
                <AppMark name={app.mark} size={23} />
              </span>
              <span className="text-[0.75rem] font-medium">{app.name}</span>
            </>
          );

          if (app.status !== 'ready' || !app.href) {
            return (
              <span
                key={app.id}
                title={`${app.name}. Not built yet.`}
                className={`${app.accentClass} flex w-full cursor-default flex-col items-center gap-1.5 rounded-lg py-2 text-ink-3 opacity-50 grayscale`}
              >
                {inner}
              </span>
            );
          }

          return (
            <Link
              key={app.id}
              href={app.href}
              className={`${app.accentClass} flex w-full flex-col items-center gap-1.5 rounded-lg py-2 text-ink-2 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink`}
            >
              {inner}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-2">
        <ThemeToggle />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="icon" title="Lock Squirl" aria-label="Lock Squirl">
            <Lock size={15} />
          </Button>
        </form>
      </div>

      <span className="my-4 h-px w-9 bg-line" />

      {/* Not a badge. It is the one claim the whole product rests on, so it is
          stated on the screen you see most — and it opens the file's actual
          size, path and last write, so the claim can be checked from the place
          it is made rather than taken on trust. */}
      <StorageSheet facts={storage}>
        <button
          type="button"
          title="Where your data lives"
          className="w-full rounded-lg px-2 py-2 text-center text-[0.6875rem] leading-[1.5] text-ink-3 transition-colors duration-[var(--t-state)] hover:bg-surface-2 hover:text-ink-2"
        >
          <span className="flex items-center justify-center gap-1.5 font-medium text-ink-2">
            <span className="size-1.5 rounded-full bg-[var(--in)]" aria-hidden="true" />
            All local
          </span>
          <span className="mt-1.5 block">No sync.</span>
          <span className="block">No cloud.</span>
        </button>
      </StorageSheet>
    </aside>
  );
}
