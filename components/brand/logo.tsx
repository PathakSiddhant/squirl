import Image from 'next/image';

import { cn } from '@/lib/cn';
import brand from '@/lib/brand.json';

/**
 * The brand, served as the artwork itself.
 *
 * The wordmark is deliberately NOT set in a web font. Its letterforms are
 * custom: the acorn dot over the I, the crescent on the S, the exact weight and
 * spacing. Approximating that with the nearest available typeface would be
 * visibly not-quite-right on every screen, which is worse than not trying.
 *
 * Dimensions come from `lib/brand.json`, written by `npm run brand:build` after
 * trimming each PNG to its ink. The source files carry a lot of transparent
 * padding, so laying them out at their file dimensions reserved a box that was
 * mostly empty and made the logo look small and soft.
 */

const MARK_RATIO = brand.mark.width / brand.mark.height;
const LOCKUP_RATIO = brand.lockup.width / brand.lockup.height;

/**
 * `quality={100}` because this is a logo. The default of 75 is tuned for
 * photographs and puts visible mush into flat, vector-style artwork. Next still
 * serves a correctly sized image per device pixel ratio, so the extra bytes are
 * only spent on the pixels the mark actually occupies.
 */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  const width = Math.round(size * MARK_RATIO);
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      width={brand.mark.width}
      height={brand.mark.height}
      quality={100}
      priority
      sizes={`${width * 2}px`}
      className={cn('shrink-0 object-contain', className)}
      style={{ width, height: size }}
    />
  );
}

/**
 * The full lockup: squirrel above the wordmark, exactly as drawn.
 * `size` is the rendered height in pixels.
 */
export function Lockup({
  size = 64,
  className,
  alt = 'Squirl',
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  const width = Math.round(size * LOCKUP_RATIO);
  return (
    <Image
      src="/brand/lockup.png"
      alt={alt}
      width={brand.lockup.width}
      height={brand.lockup.height}
      quality={100}
      priority
      sizes={`${width * 2}px`}
      className={cn('shrink-0 object-contain', className)}
      style={{ width, height: size }}
    />
  );
}

/**
 * The name as plain text, for places where an image would be wrong: the
 * document title, a sentence, a screen reader. Never used as the visible
 * wordmark, which is always the artwork.
 */
export const BRAND_NAME = 'Squirl';
