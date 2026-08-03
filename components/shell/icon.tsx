'use client';

/*
  Icons are imported one module at a time, never from the package barrel.

  `@phosphor-icons/react` and its `/dist/ssr` entry each re-export a little over
  three thousand components. Pulling either into the graph exhausts the stack in
  Next's build workers and kills the build outright. Deep imports keep the graph
  to exactly the icons actually used.
*/
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { ArrowUDownLeft } from '@phosphor-icons/react/dist/csr/ArrowUDownLeft';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { ArrowUUpRight } from '@phosphor-icons/react/dist/csr/ArrowUUpRight';
import { ArrowsLeftRight } from '@phosphor-icons/react/dist/csr/ArrowsLeftRight';
import { Bank } from '@phosphor-icons/react/dist/csr/Bank';
import { Basket } from '@phosphor-icons/react/dist/csr/Basket';
import { BowlFood } from '@phosphor-icons/react/dist/csr/BowlFood';
import { Briefcase } from '@phosphor-icons/react/dist/csr/Briefcase';
import { Bus } from '@phosphor-icons/react/dist/csr/Bus';
import { ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar';
import { Circle } from '@phosphor-icons/react/dist/csr/Circle';
import { Coffee } from '@phosphor-icons/react/dist/csr/Coffee';
import { Coins } from '@phosphor-icons/react/dist/csr/Coins';
import { DeviceMobile } from '@phosphor-icons/react/dist/csr/DeviceMobile';
import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree';
import { FilmSlate } from '@phosphor-icons/react/dist/csr/FilmSlate';
import { ForkKnife } from '@phosphor-icons/react/dist/csr/ForkKnife';
import { GearSix } from '@phosphor-icons/react/dist/csr/GearSix';
import { Gift } from '@phosphor-icons/react/dist/csr/Gift';
import { HandArrowDown } from '@phosphor-icons/react/dist/csr/HandArrowDown';
import { HandCoins } from '@phosphor-icons/react/dist/csr/HandCoins';
import { HandHeart } from '@phosphor-icons/react/dist/csr/HandHeart';
import { Heartbeat } from '@phosphor-icons/react/dist/csr/Heartbeat';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { ListDashes } from '@phosphor-icons/react/dist/csr/ListDashes';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { Repeat } from '@phosphor-icons/react/dist/csr/Repeat';
import { Scales } from '@phosphor-icons/react/dist/csr/Scales';
import { ShoppingBag } from '@phosphor-icons/react/dist/csr/ShoppingBag';
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import { Wallet } from '@phosphor-icons/react/dist/csr/Wallet';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react/dist/lib/types';

/**
 * A closed set of icons, resolved by name.
 *
 * Categories store an icon name in the database, so a whitelist means a bad
 * value renders a neutral circle instead of crashing the page.
 */
const ICONS: Record<string, PhosphorIcon> = {
  ArrowDown,
  ArrowUp,
  ArrowsLeftRight,
  ArrowUDownLeft,
  ArrowUUpRight,
  Bank,
  Basket,
  BowlFood,
  Briefcase,
  Bus,
  ChartBar,
  Circle,
  Coffee,
  Coins,
  DeviceMobile,
  DotsThree,
  FilmSlate,
  ForkKnife,
  GearSix,
  Gift,
  HandArrowDown,
  HandCoins,
  HandHeart,
  Heartbeat,
  House,
  Lightning,
  ListDashes,
  Receipt,
  Repeat,
  Scales,
  ShoppingBag,
  Users,
  Wallet,
};

export function Icon({
  name,
  size = 16,
  weight = 'regular',
  className,
}: {
  name: string | null | undefined;
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  className?: string;
}) {
  const Component = (name && ICONS[name]) || Circle;
  return <Component size={size} weight={weight} className={className} aria-hidden />;
}
