'use client';

import { BowlFood } from '@phosphor-icons/react/dist/csr/BowlFood';
import { Bread } from '@phosphor-icons/react/dist/csr/Bread';
import { Carrot } from '@phosphor-icons/react/dist/csr/Carrot';
import { Coffee } from '@phosphor-icons/react/dist/csr/Coffee';
import { Cookie } from '@phosphor-icons/react/dist/csr/Cookie';
import { Drop } from '@phosphor-icons/react/dist/csr/Drop';
import { ForkKnife } from '@phosphor-icons/react/dist/csr/ForkKnife';
import { Leaf } from '@phosphor-icons/react/dist/csr/Leaf';
import { Cheese } from '@phosphor-icons/react/dist/csr/Cheese';
import { Cherries } from '@phosphor-icons/react/dist/csr/Cherries';
import type { Icon } from '@phosphor-icons/react';

import { cn } from '@/lib/cn';
import { KIND_TINT, kindOf, type FoodKind } from '@/lib/form/food-kind';

/**
 * A food, as a picture.
 *
 * ## Three states, in order of preference
 *
 * A photograph if the food has one; an icon for the kind of thing it is if it
 * does not; a bowl and cutlery if even that is unknown. There is always
 * something in the square — a list where some rows carry a picture and others
 * carry a hole is worse than one with no pictures at all.
 *
 * Emoji were tried here and thrown out. They are somebody else's illustration
 * style dropped into the middle of the application, they render differently on
 * every machine, and at this size they read as a chat message rather than as
 * part of an instrument.
 */

const ICONS: Record<FoodKind, Icon> = {
  grain: Bread,
  pulse: BowlFood,
  vegetable: Carrot,
  fruit: Cherries,
  dairy: Cheese,
  nut: Leaf,
  sweet: Cookie,
  drink: Coffee,
  oil: Drop,
  other: ForkKnife,
};

export function FoodPicture({
  name,
  image,
  size = 40,
  className,
}: {
  name: string;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const kind = kindOf(name);
  const tint = KIND_TINT[kind];
  const Glyph = ICONS[kind];
  const radius = Math.round(size * 0.26);

  if (image) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- the source is a
         data: URL held in the row, so there is nothing for the image optimiser
         to fetch, resize or cache. */
      <img
        src={image}
        alt=""
        className={cn('shrink-0 object-cover', className)}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          border: '1px solid var(--form-edge)',
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center', className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `oklch(${tint} / 0.1)`,
        border: `1px solid oklch(${tint} / 0.28)`,
        color: `oklch(${tint})`,
      }}
    >
      <Glyph size={Math.round(size * 0.46)} weight="duotone" />
    </span>
  );
}
