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
 * Grouped, and every item carries a plain-English blurb.
 *
 * A bare list of seven nouns is exactly what made the first version hard to
 * read. Headings say what a group is for, and the blurb answers "what is this"
 * without anyone having to click to find out.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'Money',
    items: [
      { href: '/', label: 'Today', icon: 'House', blurb: 'How you are doing right now', primary: true },
      { href: '/ledger', label: 'History', icon: 'ListDashes', blurb: 'Everything, day by day', primary: true },
      { href: '/accounts', label: 'Accounts', icon: 'Wallet', blurb: 'Your piles of money' },
    ],
  },
  {
    heading: 'Owed',
    items: [
      { href: '/people', label: 'People', icon: 'Users', blurb: 'Who owes who, and how much', primary: true },
      { href: '/loans', label: 'Loans', icon: 'Bank', blurb: 'Borrowing with a schedule', primary: true },
    ],
  },
  {
    heading: 'Looking back',
    items: [
      { href: '/insights', label: 'Insights', icon: 'ChartBar', blurb: 'Where it actually went' },
      { href: '/progress', label: 'Progress', icon: 'Coffee', blurb: 'Streaks and milestones' },
    ],
  },
  {
    heading: 'Help',
    items: [
      { href: '/guide', label: 'How it works', icon: 'Question', blurb: 'Everything, in plain words' },
      { href: '/settings', label: 'Settings', icon: 'GearSix', blurb: 'Tune the safe-to-spend maths' },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
