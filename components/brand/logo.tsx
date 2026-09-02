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

const WORD_RATIO = brand.wordmark.width / brand.wordmark.height;

/**
 * The mark and the word, side by side.
 *
 * The drawn lockup stacks them, which is the wrong shape for a header that has
 * to sit on one line. This sets the same two pieces of artwork in a row: the
 * word is cut from the lockup itself by `npm run brand:build`, so the
 * letterforms are the real ones rather than a typeface standing in for them.
 *
 * `size` is the height of the squirrel. The word is set smaller and optically
 * centred against it, the way it sits in the original.
 */
export function LockupRow({
  size = 44,
  className,
  alt = 'Squirl',
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  const wordHeight = Math.round(size * 0.42);
  return (
    <span className={cn('inline-flex items-center', className)} style={{ gap: size * 0.28 }}>
      <Mark size={size} />
      <Image
        src="/brand/wordmark.png"
        alt={alt}
        width={brand.wordmark.width}
        height={brand.wordmark.height}
        quality={100}
        priority
        sizes={`${Math.round(wordHeight * WORD_RATIO) * 2}px`}
        className="shrink-0 object-contain"
        style={{ width: Math.round(wordHeight * WORD_RATIO), height: wordHeight }}
      />
    </span>
  );
}

/**
 * The name as plain text, for places where an image would be wrong: the
 * document title, a sentence, a screen reader. Never used as the visible
 * wordmark, which is always the artwork.
 */
export const BRAND_NAME = 'Squirl';

/**
 * An application's own mark.
 *
 * Squirl's squirrel is the environment; these identify one application inside
 * it. The two are never shown as equals: the squirrel identifies the product,
 * these identify a place within it. So they appear on an application's
 * launcher card and in its own header, and nowhere else.
 */
export type AppMarkName = 'ledger-mark' | 'form-mark';

export function AppMark({
  name,
  size = 28,
  className,
}: {
  name: AppMarkName;
  size?: number;
  className?: string;
}) {
  const art = brand[name];
  const width = Math.round(size * (art.width / art.height));
  return (
    <Image
      src={`/brand/${name}.png`}
      alt=""
      width={art.width}
      height={art.height}
      quality={100}
      sizes={`${width * 2}px`}
      className={cn('shrink-0 object-contain', className)}
      style={{ width, height: size }}
    />
  );
}

export function LedgerMark({ size = 28, className }: { size?: number; className?: string }) {
  return <AppMark name="ledger-mark" size={size} className={className} />;
}
