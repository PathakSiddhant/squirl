import type { Route } from 'next';

export interface NavItem {
  href: Route;
  label: string;
  icon: string;
  /** One line, shown as a tooltip and on the mobile menu. */
  blurb: string;
  /** Shown in the mobile tab bar. */
  primary?: boolean;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

/**
 * Ledger's navigation. Grouped, and every item carries a plain-English blurb.
 *
 * A bare list of seven nouns is exactly what made the first version hard to
 * read. Headings say what a group is for, and the blurb answers "what is this"
 * without anyone having to click to find out.
 *
 * Everything lives under /ledger because Ledger is one application inside
 * Squirl rather than the whole product. Note that the day-by-day view is
 * called History: it used to be "Ledger", which now names the application and
 * could not also name one tab inside it.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'Money',
    items: [
      { href: '/ledger', label: 'Today', icon: 'House', blurb: 'How you are doing right now', primary: true },
      {
        href: '/ledger/history',
        label: 'History',
        icon: 'ListDashes',
        blurb: 'Everything, day by day',
        primary: true,
      },
      { href: '/ledger/accounts', label: 'Accounts', icon: 'Wallet', blurb: 'Your piles of money' },
      {
        href: '/ledger/repeating',
        label: 'Repeating',
        icon: 'Repeat',
        blurb: 'Subscriptions and auto-debits',
      },
    ],
  },
  {
    heading: 'Owed',
    items: [
      {
        href: '/ledger/people',
        label: 'People',
        icon: 'Users',
        blurb: 'Who owes who, and how much',
        primary: true,
      },
      { href: '/ledger/loans', label: 'Loans', icon: 'Bank', blurb: 'Borrowing with a schedule', primary: true },
    ],
  },
  {
    heading: 'Looking back',
    items: [
      { href: '/ledger/insights', label: 'Insights', icon: 'ChartBar', blurb: 'Where it actually went' },
      { href: '/ledger/progress', label: 'Progress', icon: 'Coffee', blurb: 'Streaks and milestones' },
    ],
  },
  {
    heading: 'Help',
    items: [
      { href: '/ledger/guide', label: 'How it works', icon: 'Question', blurb: 'Everything, in plain words' },
      {
        href: '/ledger/settings',
        label: 'Settings',
        icon: 'GearSix',
        blurb: 'Tune the safe-to-spend maths',
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
