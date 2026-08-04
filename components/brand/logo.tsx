import Image from 'next/image';

import { cn } from '@/lib/cn';

/**
 * The mark, straight from brand-assets.
 *
 * The source artwork is 1508x1043, so it is sized by height with the width
 * derived from that ratio. Forcing it square squashes the tail, which is the
 * most recognisable part of the silhouette.
 *
 * The charcoal in the artwork is the same hue the neutral tokens are built on,
 * so it sits on both themes without a halo or a knocked-out box.
 */
const RATIO = 1508 / 1043;

export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  const width = Math.round(size * RATIO);
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      width={width}
      height={size}
      priority
      sizes={`${width}px`}
      className={cn('shrink-0 object-contain', className)}
      style={{ width, height: size }}
    />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-semibold uppercase tracking-[0.18em] text-ink', className)}>
      Squirl
    </span>
  );
}

export function Lockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark size={compact ? 20 : 26} />
      <Wordmark className={compact ? 'text-[0.8125rem]' : 'text-[0.9375rem]'} />
    </span>
  );
}
