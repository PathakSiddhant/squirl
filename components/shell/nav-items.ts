import type { Route } from 'next';

export interface NavItem {
  href: Route;
  label: string;
  icon: string;
  /** Shown in the mobile tab bar. */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Today', icon: 'House', primary: true },
  { href: '/ledger', label: 'Ledger', icon: 'ListDashes', primary: true },
  { href: '/people', label: 'People', icon: 'Users', primary: true },
  { href: '/loans', label: 'Loans', icon: 'Bank', primary: true },
  { href: '/accounts', label: 'Accounts', icon: 'Wallet' },
  { href: '/insights', label: 'Insights', icon: 'ChartBar' },
  { href: '/settings', label: 'Settings', icon: 'GearSix' },
];
