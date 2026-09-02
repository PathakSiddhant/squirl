import type { Route } from 'next';

import type { AppMarkName } from '@/components/brand/logo';

/**
 * The registry of installed applications.
 *
 * This file is the entire coupling between Squirl and the things it hosts. An
 * application declares a name, a mark, a route, an accent, and optionally a
 * snapshot of itself for the launcher. Squirl renders that and nothing else:
 * it does not know what a transaction is, and it never imports an
 * application's domain logic to decide how to draw a card.
 *
 * Adding an application means adding an entry here and a directory under
 * app/(squirl). Removing one means deleting both. Nothing else in the shell
 * has to change, which is the property worth protecting.
 */

export interface AppStat {
  label: string;
  /** Already formatted. Squirl does not know how to format an application's units. */
  value: string;
  note?: string;
}

export interface AppSnapshot {
  stats: AppStat[];
  /** A short series for the launcher spark. Raw numbers; the shape is all that is read. */
  trend?: number[];
  trendLabel?: string;
  trendValue?: string;
  /** Lets an application say "this needs attention" without inventing a colour. */
  tone?: 'normal' | 'attention';
}

export interface SquirlApp {
  id: string;
  name: string;
  /** One line. What the application is for, not what it can do. */
  tagline: string;
  mark: AppMarkName;
  /**
   * Class that fills the --app-accent slot for this application. Defined in
   * globals.css next to the tokens it overrides.
   */
  accentClass: string;
  /**
   * `planned` means the idea is settled but nothing is built. It gets a card
   * so the shape of Squirl is honest, and no route, because there is nowhere
   * to go. It never gets invented numbers.
   */
  status: 'ready' | 'planned';
  href?: Route;
  /** For a planned application: what it will be, in one line. */
  note?: string;
  /**
   * Reads what is worth seeing before opening the application. Optional: one
   * with nothing useful to say from outside should say nothing rather than
   * manufacture a metric.
   */
  snapshot?: () => Promise<AppSnapshot | null>;
}

export const APPS: SquirlApp[] = [
  {
    id: 'ledger',
    name: 'Ledger',
    tagline: 'Money you spent, money you lent, money you put away.',
    mark: 'ledger-mark',
    accentClass: 'app-ledger',
    status: 'ready',
    href: '/ledger',
    snapshot: async () => {
      // Imported here rather than at the top of the file so that the shell
      // does not pull Ledger's database queries into every route that only
      // wanted the list of application names.
      const { getOverview } = await import('@/lib/queries/overview');
      const { formatMoney } = await import('@/lib/money');

      const overview = await getOverview();
      const { position } = overview;
      const days = overview.recentDays.slice(-14);
      const spent = days.reduce((total, day) => total + day.out, 0);

      return {
        tone: position.isUnderwater ? 'attention' : 'normal',
        stats: [
          position.isUnderwater
            ? {
                label: 'Short by',
                value: formatMoney(position.shortfall),
                note: 'more promised than held',
              }
            : { label: 'Safe to spend', value: formatMoney(position.safeToSpend), note: 'today' },
          { label: 'Net worth', value: formatMoney(position.netWorth), note: 'everything, minus debt' },
          { label: 'Promised', value: formatMoney(position.committed), note: 'due in 30 days' },
        ],
        trend: days.map((day) => day.out),
        trendLabel: 'Spending, last 14 days',
        trendValue: formatMoney(spent),
      };
    },
  },
  {
    id: 'form',
    name: 'Form',
    tagline: 'Training, and what it is actually doing to you.',
    mark: 'form-mark',
    accentClass: 'app-form',
    status: 'planned',
    note: 'It has a place here so the shape of Squirl is honest. Nothing is stored for it, and nothing is counted from it, until there is something real behind it.',
  },
];

export function findApp(id: string): SquirlApp | undefined {
  return APPS.find((app) => app.id === id);
}
