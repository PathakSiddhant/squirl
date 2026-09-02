import Image from 'next/image';

import { cn } from '@/lib/cn';
import type { DeskPhase } from '@/lib/squirl/phase';

/**
 * The landscape on the threshold.
 *
 * Two illustrations, day and night, drawn as one matched pair: same
 * composition, same rock, same squirrel, so moving between them never shifts
 * anything on screen. Which one shows is decided by two honest signals and
 * nothing else: the hour where the owner actually is, resolved in IST on the
 * server, and the theme they chose.
 *
 * Both are rendered and CSS picks one, because the theme is a class on the
 * document and is not known while the server renders. Together they come to
 * about a hundred kilobytes, which is cheaper than a flash of the wrong one.
 *
 * The choosing lives in globals.css, next to the ink and wordmark rules that
 * have to agree with it. Deciding it here in two ternaries is how the theme
 * came to be ignored after dark: the hour hard-coded `hidden` onto the day
 * picture, and no theme class could reach past it.
 *
 * Nothing here is scaled or offset. An earlier version drifted the whole frame
 * under the pointer, which meant blowing it up past its edges to have somewhere
 * to drift to: the picture was permanently cropped to pay for an effect you
 * only saw while moving the mouse. The movement is a light crossing the valley
 * now. It costs no crop, it runs on its own, and the scene is whole the moment
 * the page opens.
 */
export function ThresholdScene({ phase }: { phase: DeskPhase }) {
  // Only used to decide which file to fetch first. The hour is the right guess:
  // it is what shows unless a reader has overruled it by hand.
  const nightByHour = phase === 'night';

  // The column is capped near the illustration's own three-by-four shape, so
  // only the dark foot of the picture is ever trimmed. Biased slightly upward,
  // because the empty top of the sky is worth less than the rock and the
  // squirrel at the bottom.
  //
  // A phone is the exception: a short band with nothing over it but the
  // wordmark, so it crops harder and sits lower to keep the sun in view.
  const art = 'object-cover object-[50%_38%] lg:object-[50%_30%]';

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <Image
        src="/brand/threshold-day.webp"
        alt=""
        fill
        priority={!nightByHour}
        quality={90}
        sizes="(min-width: 1024px) 58vw, 100vw"
        className={cn(art, 'scene-day')}
      />
      <Image
        src="/brand/threshold-night.webp"
        alt=""
        fill
        priority={nightByHour}
        quality={90}
        sizes="(min-width: 1024px) 58vw, 100vw"
        className={cn(art, 'scene-night')}
      />

      <span className="scene-light" />
    </div>
  );
}
