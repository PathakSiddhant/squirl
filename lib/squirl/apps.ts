import type { Route } from 'next';

/**
 * The registry of installed applications.
 *
 * This file is the entire coupling between Squirl and the things it hosts. An
 * application declares a name, a mark, a route, an accent, and optionally one
 * live figure for its card. Squirl renders that and nothing else: it does not
 * know what a transaction is, and it never imports an application's domain
 * logic to decide how to draw the launcher.
 *
 * Adding the second application means adding an entry here and a directory
 * under app/(squirl). Removing one means deleting both. Nothing else in the
 * shell has to change, which is the property worth protecting.
 *
 * There is exactly one application today. That is not a placeholder waiting to
 * be filled with a roadmap: the list is honest about what exists.
 */

export interface AppSignal {
  /** What the number is, in plain words. */
  label: string;
  /** Already formatted for display. Squirl does not know how to format money. */
  value: string;
  /** Lets an application say "this needs attention" without inventing a colour. */
  tone?: 'normal' | 'attention';
}

export interface SquirlApp {
  id: string;
  name: string;
  /** One line. What the application is for, not what it can do. */
  tagline: string;
  href: Route;
  /**
   * Class that fills the --app-accent slot while you are inside this
   * application. Defined in globals.css next to the tokens it overrides.
   */
  accentClass: string;
  /**
   * Reads one figure worth seeing before you open the application. Optional:
   * an application that has nothing useful to say from outside should say
   * nothing rather than manufacture a metric.
   */
  signal: () => Promise<AppSignal | null>;
}

export const APPS: SquirlApp[] = [
  {
    id: 'ledger',
    name: 'Ledger',
    tagline: 'Money you spent, money you lent, money you put away.',
    href: '/ledger',
    accentClass: 'app-ledger',
    signal: async () => {
      // Imported here rather than at the top of the file so that the shell
      // does not pull Ledger's database queries into every route that only
      // wanted the list of application names.
      const { getOverview } = await import('@/lib/queries/overview');
      const { formatMoney } = await import('@/lib/money');

      const overview = await getOverview();
      if (overview.position.isUnderwater) {
        return {
          label: 'short of what you have promised',
          value: formatMoney(overview.position.shortfall),
          tone: 'attention',
        };
      }
      return { label: 'safe to spend', value: formatMoney(overview.position.safeToSpend) };
    },
  },
];

export function findApp(id: string): SquirlApp | undefined {
  return APPS.find((app) => app.id === id);
}
