import type { TransactionKind } from '@/lib/db/schema';

export type MoneyTone = 'in' | 'out' | 'owed-me' | 'i-owe' | 'parked' | 'neutral';

export interface KindMeta {
  label: string;
  /** Which way the money moved, for the sign glyph. */
  direction: 'in' | 'out' | 'flat';
  tone: MoneyTone;
  icon: string;
  /** Short sentence used in the ledger when there is no note. */
  describe: string;
}

/**
 * One place that decides how every kind of movement is named and coloured.
 *
 * Lending and borrowing are `flat`: the money moved, but nothing was gained or
 * lost, and the ledger must not dress them up as income or spending.
 */
export const KIND_META: Record<TransactionKind, KindMeta> = {
  income: { label: 'Income', direction: 'in', tone: 'in', icon: 'ArrowDown', describe: 'Money came in' },
  expense: { label: 'Spent', direction: 'out', tone: 'out', icon: 'ArrowUp', describe: 'Money spent' },
  transfer: {
    label: 'Moved',
    direction: 'flat',
    tone: 'parked',
    icon: 'ArrowsLeftRight',
    describe: 'Moved between your own accounts',
  },
  lend: {
    label: 'Lent out',
    direction: 'out',
    tone: 'owed-me',
    icon: 'HandCoins',
    describe: 'Lent out, still yours',
  },
  borrow: {
    label: 'Borrowed',
    direction: 'in',
    tone: 'i-owe',
    icon: 'HandArrowDown',
    describe: 'Borrowed, has to go back',
  },
  collect: {
    label: 'Got back',
    direction: 'in',
    tone: 'owed-me',
    icon: 'ArrowUDownLeft',
    describe: 'Money you lent, returned',
  },
  settle: {
    label: 'Paid back',
    direction: 'out',
    tone: 'i-owe',
    icon: 'ArrowUUpRight',
    describe: 'Money you borrowed, returned',
  },
  loan_taken: {
    label: 'Loan taken',
    direction: 'in',
    tone: 'i-owe',
    icon: 'Bank',
    describe: 'Loan disbursed',
  },
  loan_payment: {
    label: 'EMI',
    direction: 'out',
    tone: 'i-owe',
    icon: 'Receipt',
    describe: 'Installment paid',
  },
  adjust_up: {
    label: 'Found',
    direction: 'in',
    tone: 'neutral',
    icon: 'Scales',
    describe: 'Reconciled up',
  },
  adjust_down: {
    label: 'Missing',
    direction: 'out',
    tone: 'neutral',
    icon: 'Scales',
    describe: 'Reconciled down',
  },
};

export const METHOD_LABEL: Record<string, string> = {
  upi: 'UPI',
  card: 'Card',
  cash: 'Cash',
  bank: 'Bank',
  auto: 'Auto',
  other: 'Other',
};

export const TONE_TEXT: Record<MoneyTone, string> = {
  in: 'text-[var(--in-text)]',
  out: 'text-[var(--out-text)]',
  'owed-me': 'text-[var(--owed-me-text)]',
  'i-owe': 'text-[var(--i-owe-text)]',
  parked: 'text-[var(--parked-text)]',
  neutral: 'text-ink-2',
};

export const TONE_BG: Record<MoneyTone, string> = {
  in: 'bg-[var(--in)]',
  out: 'bg-[var(--out)]',
  'owed-me': 'bg-[var(--owed-me)]',
  'i-owe': 'bg-[var(--i-owe)]',
  parked: 'bg-[var(--parked)]',
  neutral: 'bg-ink-3',
};

export const TONE_WASH: Record<MoneyTone, string> = {
  in: 'bg-[var(--in-wash)]',
  out: 'bg-[var(--out-wash)]',
  'owed-me': 'bg-[var(--owed-me-wash)]',
  'i-owe': 'bg-[var(--i-owe-wash)]',
  parked: 'bg-[var(--parked-wash)]',
  neutral: 'bg-surface-2',
};
