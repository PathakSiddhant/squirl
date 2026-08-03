import { monthsBetween, type DayString } from '../date';
import type { Paise } from '../money';
import type { InterestKind } from '../db/schema';

/**
 * Interest on money lent to, or borrowed from, a person.
 *
 * The engine replays the debt as a timeline rather than storing a balance.
 * Every principal tranche accrues from its own day, and every repayment is
 * applied to outstanding interest before it touches principal, which is the
 * convention people actually use when settling with a friend.
 *
 * Internally interest is carried as a float and only rounded on the way out.
 * Rounding at each step would drift by a paisa per event over a debt that runs
 * for months.
 */

export interface DebtTerms {
  openedOn: DayString;
  interestKind: InterestKind;
  /** Basis points per month. 100 bps = 1.00% per month. */
  rateBpsPerMonth: number;
}

export type DebtEvent =
  | { type: 'principal'; day: DayString; amount: Paise }
  | { type: 'repayment'; day: DayString; amount: Paise; interestPart: Paise };

export interface DebtPosition {
  /** Principal still out there, excluding interest. */
  outstandingPrincipal: Paise;
  /** Interest accrued under the terms and not yet paid. */
  accruedInterest: Paise;
  /** What it would take to close the debt completely, as of `asOf`. */
  payoffTotal: Paise;
  /** Everything ever handed over. */
  principalAdvanced: Paise;
  /** Everything ever received back, principal and interest together. */
  totalRepaid: Paise;
  /** The interest slice of everything received back. */
  interestPaid: Paise;
  /** True once principal and accrued interest are both cleared. */
  isCleared: boolean;
}

function monthlyRate(terms: DebtTerms): number {
  if (terms.interestKind === 'none') return 0;
  return terms.rateBpsPerMonth / 10_000;
}

/**
 * Replays a debt to `asOf` and reports where it stands.
 *
 * Events do not need to be sorted; they are ordered here so callers can pass
 * whatever the database handed back.
 */
export function computeDebtPosition(
  terms: DebtTerms,
  events: DebtEvent[],
  asOf: DayString,
): DebtPosition {
  const rate = monthlyRate(terms);
  const compound = terms.interestKind === 'compound';

  const ordered = [...events].sort((a, b) => {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    // Principal lands before repayments on the same day, so same-day churn
    // cannot drive the balance negative and clamp away real principal.
    return a.type === b.type ? 0 : a.type === 'principal' ? -1 : 1;
  });

  let outstanding = 0;
  let accrued = 0;
  let principalAdvanced = 0;
  let totalRepaid = 0;
  let interestPaid = 0;
  let cursor = terms.openedOn;

  const accrue = (to: DayString) => {
    if (rate <= 0 || outstanding <= 0) {
      cursor = to;
      return;
    }
    const months = monthsBetween(cursor, to);
    if (months <= 0) {
      cursor = to;
      return;
    }
    if (compound) {
      const base = outstanding + accrued;
      accrued += base * Math.pow(1 + rate, months) - base;
    } else {
      accrued += outstanding * rate * months;
    }
    cursor = to;
  };

  for (const event of ordered) {
    if (event.day > asOf) break;
    accrue(event.day);

    if (event.type === 'principal') {
      outstanding += event.amount;
      principalAdvanced += event.amount;
    } else {
      totalRepaid += event.amount;
      interestPaid += event.interestPart;
      accrued = Math.max(0, accrued - event.interestPart);
      outstanding = Math.max(0, outstanding - (event.amount - event.interestPart));
    }
  }

  accrue(asOf);

  const outstandingPrincipal = Math.round(outstanding);
  const accruedInterest = Math.round(accrued);

  return {
    outstandingPrincipal,
    accruedInterest,
    payoffTotal: outstandingPrincipal + accruedInterest,
    principalAdvanced,
    totalRepaid,
    interestPaid,
    isCleared: outstandingPrincipal <= 0 && accruedInterest <= 0,
  };
}

/**
 * The split to pre-fill when someone settles up. Interest is cleared first,
 * then principal, so a partial payment does the least surprising thing.
 */
export function splitRepayment(position: DebtPosition, amount: Paise): {
  interestPart: Paise;
  principalPart: Paise;
} {
  const interestPart = Math.min(amount, Math.max(0, position.accruedInterest));
  return { interestPart, principalPart: amount - interestPart };
}

/**
 * What this debt will be worth on a future day if nothing is repaid.
 * Used by the forecast to show money that is genuinely on its way back.
 */
export function projectDebt(
  terms: DebtTerms,
  events: DebtEvent[],
  asOf: DayString,
  futureDay: DayString,
): Paise {
  if (futureDay <= asOf) return computeDebtPosition(terms, events, asOf).payoffTotal;
  return computeDebtPosition(terms, events, futureDay).payoffTotal;
}

/** Human-readable terms, e.g. "2% a month, compounding". */
export function describeTerms(terms: DebtTerms): string {
  if (terms.interestKind === 'none' || terms.rateBpsPerMonth === 0) return 'no interest';
  const pct = terms.rateBpsPerMonth / 100;
  const rendered = Number.isInteger(pct) ? `${pct}` : pct.toFixed(2).replace(/0$/, '');
  return `${rendered}% a month, ${terms.interestKind === 'compound' ? 'compounding' : 'simple'}`;
}
