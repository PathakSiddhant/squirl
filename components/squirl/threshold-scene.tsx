'use client';

import { motion, useTransform, type MotionValue } from 'motion/react';
import Image from 'next/image';

import { cn } from '@/lib/cn';
import type { DeskPhase } from '@/lib/squirl/phase';

/**
 * The landscape on the threshold.
 *
 * Two illustrations, day and night, drawn as one matched pair: same
 * composition, same rock, same squirrel, so moving between them never shifts
 * anything on screen. Which one shows is decided by two things, and both are
 * honest signals rather than settings: the hour where the owner actually is,
 * resolved in IST on the server, and the theme they chose.
 *
 * Both are rendered and CSS picks one, because the theme is a class on the
 * document and is not known while the server is rendering. They come to about
 * a hundred kilobytes together, which is cheaper than the flash of a wrong
 * illustration.
 *
 * The whole frame drifts a little under the pointer. It is scaled up slightly
 * to give that drift somewhere to go, so the edges never pull away from the
 * panel.
 */
export function ThresholdScene({
  pointerX,
  pointerY,
  live,
  phase,
}: {
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  live: boolean;
  phase: DeskPhase;
}) {
  const x = useTransform(pointerX, [0, 1], [16, -16]);
  const y = useTransform(pointerY, [0, 1], [11, -11]);

  const nightByHour = phase === 'night';

  // Anchored to the sky, not the middle.
  //
  // Centring the crop looked right on a tall window and fell apart on a short
  // one: the horizon climbed into the headline and the words ended up sitting
  // on the sun. Anchoring the top means the clear sky is always the first
  // thing in frame, so the text has somewhere to be at any height, and it is
  // the empty foreground that gets trimmed instead.
  //
  // A phone is the exception. There the scene is a short band with nothing set
  // over it but the wordmark, so it can sit lower and keep the sun and the
  // squirrel in view.
  const art = 'object-cover object-[50%_38%] lg:object-top';

  return (
    <motion.div
      aria-hidden="true"
      style={live ? { x, y } : undefined}
      className="absolute inset-0 scale-[1.06]"
    >
      <Image
        src="/brand/threshold-day.webp"
        alt=""
        fill
        priority={!nightByHour}
        quality={90}
        sizes="(min-width: 1024px) 54vw, 100vw"
        className={cn(art, nightByHour ? 'hidden' : 'block dark:hidden')}
      />
      <Image
        src="/brand/threshold-night.webp"
        alt=""
        fill
        priority={nightByHour}
        quality={90}
        sizes="(min-width: 1024px) 54vw, 100vw"
        className={cn(art, nightByHour ? 'block' : 'hidden dark:block')}
      />
    </motion.div>
  );
}
