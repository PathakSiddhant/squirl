'use client';

import Link from 'next/link';

import { AppMark } from '@/components/brand/logo';
import { cn } from '@/lib/cn';

import type { LauncherApp } from './launcher-app';

/**
 * Every application as a mark and its name, the way a device shows them.
 *
 * The fastest of the three views to read, because there is nothing in it to
 * read: you are recognising a shape you already know rather than parsing a
 * card. It is the view for when you know exactly where you are going, which is
 * most of the time.
 *
 * A planned application keeps its place in the grid, drawn back rather than
 * left out, so the row does not silently reorder itself the day it is built.
 */
export function IconGrid({ apps }: { apps: LauncherApp[] }) {
  return (
    <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-7 sm:gap-x-8">
      {apps.map((app, index) => (
        <IconButton key={app.id} app={app} delay={index * 60} />
      ))}
    </div>
  );
}

function IconButton({ app, delay }: { app: LauncherApp; delay: number }) {
  const open = app.status === 'ready' && Boolean(app.href);

  const inner = (
    <>
      <span
        className={cn(
          'relative flex size-[5.5rem] items-center justify-center rounded-[1.375rem] border sm:size-[6.25rem]',
          'transition-[transform,border-color,box-shadow] duration-[var(--t-move)] ease-[var(--ease)]',
          open
            ? 'border-line group-hover:-translate-y-1.5 group-hover:border-[var(--app-accent)] group-hover:shadow-[0_18px_36px_-16px_var(--app-accent)]'
            : 'border-dashed border-line opacity-55',
        )}
        style={{ backgroundColor: 'var(--app-accent-wash)' }}
      >
        <AppMark name={app.mark} size={44} />
      </span>

      <span className="mt-2.5 block text-center text-[0.8125rem] font-medium text-ink">
        {app.name}
      </span>
      <span className="mt-0.5 block text-center text-[0.6875rem] text-ink-3">
        {open ? 'Open' : 'Next'}
      </span>
    </>
  );

  const shell = cn('rise group flex w-[7rem] flex-col items-center', app.accentClass);

  if (!open || !app.href) {
    return (
      <span
        className={cn(shell, 'cursor-default')}
        style={{ animationDelay: `${delay}ms` }}
        title={`${app.name}. Not built yet.`}
      >
        {inner}
      </span>
    );
  }

  return (
    <Link href={app.href} className={shell} style={{ animationDelay: `${delay}ms` }}>
      {inner}
    </Link>
  );
}
