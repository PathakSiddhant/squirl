import { addDays, daysBetween, type DayString } from '../date';
import { atLeastZero, sum, type Paise } from '../money';
import type { AccountKind, TransactionKind } from '../db/schema';

/**
 * Where the money actually is, and how much of it is genuinely yours to spend.
 *
 * The whole app exists to answer one question correctly: how much can I spend
 * right now without breaking a promise I already made. Everything here feeds
 * that number, and every input to it is shown in the UI so it is never a
 * mystery figure the user has to take on faith.
 */

// -------------------------------------------------------------- balances

export interface LedgerMovement {
  day: DayString;
  kind: TransactionKind;
  amount: Paise;
  accountId: string | null;
  counterAccountId: string | null;
}

/** Which way a movement pushes a given account. */
export function accountDelta(movement: LedgerMovement, accountId: string): Paise {
  if (movement.kind === 'transfer' && movement.counterAccountId === accountId) {
    return movement.amount;
  }
  if (movement.accountId !== accountId) return 0;

  switch (movement.kind) {
    case 'income':
    case 'borrow':
    case 'collect':
    case 'loan_taken':
    case 'adjust_up':
      return movement.amount;
    case 'expense':
    case 'lend':
    case 'settle':
    case 'loan_payment':
    case 'adjust_down':
    case 'transfer':
      return -movement.amount;
    default:
      return 0;
  }
}

export interface AccountSeed {
  id: string;
  kind: AccountKind;
  openingBalance: Paise;
}

/** Closing balance of every account as of `asOf`, inclusive. */
export function accountBalances(
  accounts: AccountSeed[],
  movements: LedgerMovement[],
  asOf: DayString,
): Map<string, Paise> {
  const balances = new Map<string, Paise>();
  for (const account of accounts) balances.set(account.id, account.openingBalance);

  for (const movement of movements) {
    if (movement.day > asOf) continue;
    for (const [id, current] of balances) {
      const delta = accountDelta(movement, id);
      if (delta !== 0) balances.set(id, current + delta);
    }
  }

  return balances;
}

// ------------------------------------------------------------ overdraft

export interface OverdraftCheck {
  accountId: string;
  /** Negative. What the account would read if this were saved. */
  wouldBe: Paise;
}

/**
 * Whether saving a transaction would newly overdraw its account.
 *
 * "Newly" is the operative word, and it is why this compares two balances
 * rather than testing one against zero. Checking only "would the result be
 * negative" also blocks something that has nothing to do with the mistake:
 * fixing a typo in a transaction's *note*, on a day some other transaction
 * already left negative, would recompute to the same negative number and get
 * refused — trapping the very correction that might fix the real problem
 * behind an error about a field the edit never touched.
 *
 * So the question this actually asks is "does saving this leave the account
 * worse off than it already reads" — comparing what the day would total with
 * `previous` (the transaction's current form, or nothing at all if it does
 * not exist yet) against what it would total with `candidate` (the form being
 * saved). A pure metadata edit has `previous` and `candidate` worth the same,
 * so the two totals are equal and nothing is ever blocked by it, whatever the
 * pre-existing balance happens to be. A brand new transaction has no
 * `previous` at all, which behaves exactly like comparing against zero delta:
 * a credit can only raise the total, so it can never trip this, and a debit
 * is refused exactly when the account cannot actually cover it.
 *
 * Checked as of the transaction's own day, not today, so something dated last
 * Tuesday is judged against last Tuesday's running balance — the one that
 * would actually have gone negative — rather than whatever the balance
 * happens to be by the time it is typed in.
 *
 * `otherMovements` must exclude both the old and new forms of the transaction
 * under test; the caller assembles that (typically "everything except this
 * transaction's id").
 */
export function wouldOverdraw(
  accounts: AccountSeed[],
  otherMovements: LedgerMovement[],
  previous: LedgerMovement | null,
  candidate: LedgerMovement,
): OverdraftCheck | null {
  if (!candidate.accountId) return null;

  const before = accountBalances(accounts, otherMovements, candidate.day).get(candidate.accountId) ?? 0;
  const readsNowAt = before + (previous ? accountDelta(previous, candidate.accountId) : 0);
  const wouldBe = before + accountDelta(candidate, candidate.accountId);

  return wouldBe < 0 && wouldBe < readsNowAt ? { accountId: candidate.accountId, wouldBe } : null;
}

// ------------------------------------------------------------- position

/** A single thing you have already promised away, inside the horizon. */
export interface Commitment {
  id: string;
  label: string;
  dueOn: DayString;
  amount: Paise;
  source: 'installment' | 'debt' | 'recurring';
  isOverdue: boolean;
}

export interface PositionInput {
  asOf: DayString;
  accounts: AccountSeed[];
  movements: LedgerMovement[];
  /** Payoff totals of money lent out, interest included. */
  owedToMe: Paise;
  /** Payoff totals of money borrowed from people, interest included. */
  owedByMeToPeople: Paise;
  /**
   * What every active loan actually owes right now, summed.
   *
   * Not simply "principal outstanding": a loan whose interest is a fixed fee
   * decided upfront (flat, emi_known) owes that fee regardless of when it is
   * paid, so the whole remaining schedule counts. Only a `reducing` loan's
   * interest is genuinely time-dependent enough for principal-only to be the
   * honest figure. See `currentLoanLiability` in `lib/domain/loans.ts`, which
   * is where this number is actually decided per loan before being summed
   * here.
   */
  loanLiabilityOutstanding: Paise;
  commitments: Commitment[];
  /** Untouchable floor the user never wants to dip below. */
  buffer: Paise;
  /** How far ahead a promise counts against today. */
  horizonDays: number;
}

export interface Position {
  asOf: DayString;
  /** Spendable right now: bank, cash and wallet. */
  inHand: Paise;
  /** Moved to savings or held by family. Yours, but deliberately out of reach. */
  parked: Paise;
  /** In stocks, funds and the like. Yours, but its value moves on its own. */
  invested: Paise;
  owedToMe: Paise;
  iOwe: Paise;
  netWorth: Paise;
  /** Promises falling due inside the horizon, plus anything already overdue. */
  committed: Paise;
  buffer: Paise;
  safeToSpend: Paise;
  /** True when commitments already exceed what is in hand. */
  isUnderwater: boolean;
  shortfall: Paise;
  commitments: Commitment[];
  horizonEndsOn: DayString;
  balances: Map<string, Paise>;
}

const SPENDABLE_KINDS: AccountKind[] = ['bank', 'cash', 'wallet'];

export function computePosition(input: PositionInput): Position {
  const balances = accountBalances(input.accounts, input.movements, input.asOf);
  const horizonEndsOn = addDays(input.asOf, input.horizonDays);

  let inHand = 0;
  let parked = 0;
  let invested = 0;
  for (const account of input.accounts) {
    const balance = balances.get(account.id) ?? 0;
    if (account.kind === 'parked') parked += balance;
    else if (account.kind === 'invest') invested += balance;
    else if (SPENDABLE_KINDS.includes(account.kind)) inHand += balance;
  }

  // Anything already overdue still counts, however far back it slipped.
  const relevant = input.commitments
    .filter((c) => c.dueOn <= horizonEndsOn)
    .sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0));

  const committed = sum(relevant.map((c) => c.amount));
  const iOwe = input.owedByMeToPeople + input.loanLiabilityOutstanding;
  const headroom = inHand - committed - input.buffer;

  return {
    asOf: input.asOf,
    inHand,
    parked,
    invested,
    owedToMe: input.owedToMe,
    iOwe,
    netWorth: inHand + parked + invested + input.owedToMe - iOwe,
    committed,
    buffer: input.buffer,
    safeToSpend: atLeastZero(headroom),
    isUnderwater: headroom < 0,
    shortfall: atLeastZero(-headroom),
    commitments: relevant,
    horizonEndsOn,
    balances,
  };
}

// ------------------------------------------------------------ burn rate

/**
 * Average daily spend over a trailing window.
 *
 * Only `expense` counts. Lending money out, moving it to parents, or repaying
 * a loan are not burn: the first two are still your money and the third was
 * already committed. Counting them would make the runway lie.
 */
export function burnRate(movements: LedgerMovement[], asOf: DayString, windowDays: number): Paise {
  const from = addDays(asOf, -(windowDays - 1));
  const spent = sum(
    movements.filter((m) => m.kind === 'expense' && m.day >= from && m.day <= asOf).map((m) => m.amount),
  );
  return Math.round(spent / windowDays);
}

export interface Runway {
  /** Days until `inHand` reaches zero at the trailing burn rate. */
  days: number | null;
  /** The day the money runs out, if it is going to. */
  emptyOn: DayString | null;
  dailyBurn: Paise;
}

export function computeRunway(position: Position, dailyBurn: Paise): Runway {
  if (dailyBurn <= 0) return { days: null, emptyOn: null, dailyBurn };
  const days = Math.floor(position.inHand / dailyBurn);
  return {
    days,
    emptyOn: addDays(position.asOf, days),
    dailyBurn,
  };
}

/**
 * What a day can cost between now and the next money arriving.
 *
 * Framed as an observation, never as a budget: the brief explicitly rejected
 * monthly limits. When nothing is expected, it falls back to the horizon so
 * the number still means something.
 */
export function dailyAllowance(
  position: Position,
  nextIncomeOn: DayString | null,
): { perDay: Paise; untilDay: DayString; days: number } {
  const untilDay = nextIncomeOn && nextIncomeOn > position.asOf ? nextIncomeOn : position.horizonEndsOn;
  const days = Math.max(1, daysBetween(position.asOf, untilDay));
  return { perDay: Math.floor(position.safeToSpend / days), untilDay, days };
}

// ------------------------------------------------------------ day rollup

export interface DaySummary {
  day: DayString;
  in: Paise;
  out: Paise;
  net: Paise;
  count: number;
}

/**
 * Per-day in and out totals, for the ledger headers and the calendar.
 *
 * Transfers between your own accounts are deliberately excluded: moving 15,000
 * to your parents is not 15,000 of income and 15,000 of spending, and counting
 * it as either would make every chart in the app wrong.
 */
export function summariseDays(movements: LedgerMovement[]): Map<DayString, DaySummary> {
  const byDay = new Map<DayString, DaySummary>();

  for (const movement of movements) {
    if (movement.kind === 'transfer') continue;

    const entry = byDay.get(movement.day) ?? { day: movement.day, in: 0, out: 0, net: 0, count: 0 };
    const delta = movement.accountId ? accountDelta(movement, movement.accountId) : 0;

    if (delta > 0) entry.in += delta;
    else entry.out += -delta;
    entry.net = entry.in - entry.out;
    entry.count += 1;

    byDay.set(movement.day, entry);
  }

  return byDay;
}

/** Consecutive days ending today on which something was logged. */
export function loggingStreak(days: Set<DayString>, asOf: DayString): number {
  let streak = 0;
  // Today not being logged yet should not break a run that is otherwise intact.
  let cursor = days.has(asOf) ? asOf : addDays(asOf, -1);
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
