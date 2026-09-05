'use client';

import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { IST_TIME_ZONE } from '@/lib/date';

/**
 * Nothing waiting, and why.
 *
 * Three different nothings, and conflating them is how an empty screen becomes
 * confusing: a product with no channels yet, a product whose baseline has not
 * arrived, and a queue you have genuinely finished. Only the last is an
 * achievement, and even that is stated rather than celebrated. There is no
 * confetti here. Being finished is the normal state of a thing that works.
 */
export function EmptyQueue({
  kind,
  baselineAt,
}: {
  kind: 'no-channels' | 'before-baseline' | 'caught-up';
  baselineAt: number | null;
}) {
  if (kind === 'no-channels') {
    return (
      <Shell
        icon={<Plus size={18} />}
        title="No channels yet."
        body="Signal watches the channels you choose, and nothing else. Add the ones you actually care about."
        action={{ href: '/signal/channels', label: 'Choose channels' }}
      />
    );
  }

  if (kind === 'before-baseline' && baselineAt) {
    return <Baseline at={baselineAt} />;
  }

  return (
    <Shell
      icon={<Check size={18} weight="bold" />}
      tone="good"
      title="You are caught up."
      body="Nothing from your channels is waiting. New things will appear here as they arrive."
    />
  );
}

/**
 * The wait before tracking begins.
 *
 * Counted down rather than merely stated, because "starts at 5am" and "starts
 * in six hours" answer different questions and the second is the one being
 * asked. Rendered only after mount: a countdown is the one thing guaranteed to
 * disagree between the server's millisecond and the browser's.
 */
function Baseline({ at }: { at: number }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, at - Date.now()));
    tick();
    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, [at]);

  const clock = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(at);

  const hours = remaining === null ? null : Math.floor(remaining / 3_600_000);
  const minutes = remaining === null ? null : Math.floor((remaining % 3_600_000) / 60_000);

  return (
    <Shell
      icon={<Clock size={18} />}
      title="Tracking starts soon."
      body={`Signal begins watching your channels on ${clock}. Nothing published before then is brought in, so the queue starts genuinely empty.`}
      action={{ href: '/signal/channels', label: 'Add channels while you wait' }}
    >
      {hours !== null && minutes !== null ? (
        <p className="money mt-5 text-[1.75rem] leading-none text-ink" suppressHydrationWarning>
          {hours}h {String(minutes).padStart(2, '0')}m
        </p>
      ) : null}
    </Shell>
  );
}

function Shell({
  icon,
  title,
  body,
  action,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: { href: Route; label: string };
  tone?: 'good';
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-6 text-center">
      <span
        className={
          tone === 'good'
            ? 'flex size-11 items-center justify-center rounded-full bg-[var(--in-wash)] text-[var(--in-text)]'
            : 'flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink-2'
        }
      >
        {icon}
      </span>

      <h2 className="mt-5 font-serif text-[1.375rem] font-normal tracking-[-0.015em] text-ink">
        {title}
      </h2>
      <p className="mt-2.5 max-w-[26rem] text-[0.875rem] leading-relaxed text-ink-3">{body}</p>

      {children}

      {action ? (
        <Link
          href={action.href}
          className="mt-6 rounded-lg bg-ink px-4 py-2 text-[0.8125rem] font-medium text-ink-invert transition-opacity duration-[var(--t-state)] hover:opacity-90"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
