import { addMonths, type DayString } from '../date';
import { distribute, sum, type Paise } from '../money';
import type { LoanInterestModel } from '../db/schema';

/**
 * Installment schedules for a formal loan.
 *
 * Four models, because loan products in the wild are described four different
 * ways and the app should accept whichever one the user was actually told:
 *
 *   emi_known  "borrow 1,500, pay 550 a month for 3 months"  (the common case)
 *   flat       a flat annual rate on the original principal
 *   reducing   standard amortisation on the shrinking balance
 *   none       an interest-free split, e.g. a friend's structured repayment
 *
 * Every schedule satisfies two invariants, enforced by tests:
 *   sum(principalPart) === principal, exactly
 *   sum(amount) === sum(principalPart) + sum(interestPart), exactly
 */

export interface LoanSpec {
  principal: Paise;
  tenureMonths: number;
  firstDueOn: DayString;
  interestModel: LoanInterestModel;
  /** emi_known only. */
  emiAmount?: Paise;
  /** flat and reducing only. Basis points per annum. 1200 bps = 12% a year. */
  rateBpsPerAnnum?: number;
}

export interface ScheduledInstallment {
  seq: number;
  dueOn: DayString;
  amount: Paise;
  principalPart: Paise;
  interestPart: Paise;
}

export function buildSchedule(spec: LoanSpec): ScheduledInstallment[] {
  const { principal, tenureMonths, firstDueOn } = spec;
  if (tenureMonths <= 0 || principal <= 0) return [];

  const parts =
    spec.interestModel === 'reducing'
      ? reducingParts(spec)
      : flatStyleParts(spec);

  return parts.map((part, i) => ({
    seq: i + 1,
    dueOn: addMonths(firstDueOn, i),
    amount: part.principalPart + part.interestPart,
    principalPart: part.principalPart,
    interestPart: part.interestPart,
  }));
}

type Part = { principalPart: Paise; interestPart: Paise };

/**
 * emi_known, flat and none all reduce to the same shape: a known total
 * interest, spread evenly alongside an evenly spread principal.
 */
function flatStyleParts(spec: LoanSpec): Part[] {
  const { principal, tenureMonths } = spec;
  const totalInterest = totalInterestFor(spec);

  const principalParts = distribute(principal, tenureMonths);
  const interestParts = distribute(totalInterest, tenureMonths);

  return principalParts.map((principalPart, i) => ({
    principalPart,
    interestPart: interestParts[i],
  }));
}

function totalInterestFor(spec: LoanSpec): Paise {
  switch (spec.interestModel) {
    case 'emi_known': {
      const emi = spec.emiAmount ?? 0;
      // An EMI below principal/tenure would imply negative interest, which is
      // a data-entry slip rather than a gift. Floor at zero.
      return Math.max(0, emi * spec.tenureMonths - spec.principal);
    }
    case 'flat': {
      const rate = (spec.rateBpsPerAnnum ?? 0) / 10_000;
      return Math.round(spec.principal * rate * (spec.tenureMonths / 12));
    }
    case 'none':
    default:
      return 0;
  }
}

/**
 * Standard amortisation. Interest is charged on the balance that is actually
 * still outstanding, so the early installments are mostly interest and the
 * late ones are mostly principal.
 *
 * The final installment absorbs all accumulated rounding, which is exactly
 * what a real lender does, and guarantees the balance lands on zero.
 */
function reducingParts(spec: LoanSpec): Part[] {
  const { principal, tenureMonths } = spec;
  const monthlyRate = (spec.rateBpsPerAnnum ?? 0) / 10_000 / 12;

  if (monthlyRate <= 0) {
    return distribute(principal, tenureMonths).map((p) => ({ principalPart: p, interestPart: 0 }));
  }

  const growth = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = Math.round((principal * monthlyRate * growth) / (growth - 1));

  const parts: Part[] = [];
  let balance = principal;

  for (let i = 0; i < tenureMonths; i += 1) {
    const isLast = i === tenureMonths - 1;
    const interestPart = Math.round(balance * monthlyRate);

    if (isLast) {
      parts.push({ principalPart: balance, interestPart });
      balance = 0;
      break;
    }

    const principalPart = Math.min(balance, emi - interestPart);
    balance -= principalPart;
    parts.push({ principalPart, interestPart });
  }

  return parts;
}

/** The EMI a schedule implies, for display before it is saved. */
export function representativeEmi(schedule: ScheduledInstallment[]): Paise {
  if (schedule.length === 0) return 0;
  return schedule[0].amount;
}

export function scheduleTotals(schedule: ScheduledInstallment[]): {
  total: Paise;
  principal: Paise;
  interest: Paise;
} {
  return {
    total: sum(schedule.map((s) => s.amount)),
    principal: sum(schedule.map((s) => s.principalPart)),
    interest: sum(schedule.map((s) => s.interestPart)),
  };
}

/**
 * The effective annual cost of a loan described only by its EMI, so the user
 * can see what "550 a month for 3 months on 1,500" is really charging them.
 * Solved by bisection on the reducing-balance equation.
 */
export function effectiveAnnualRatePct(principal: Paise, emi: Paise, tenureMonths: number): number | null {
  if (principal <= 0 || emi <= 0 || tenureMonths <= 0) return null;
  if (emi * tenureMonths <= principal) return 0;

  const presentValue = (monthlyRate: number) => {
    if (monthlyRate === 0) return emi * tenureMonths;
    return (emi * (1 - Math.pow(1 + monthlyRate, -tenureMonths))) / monthlyRate;
  };

  let lo = 0;
  let hi = 3; // 300% a month is well past any real product
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (presentValue(mid) > principal) lo = mid;
    else hi = mid;
  }

  const monthly = (lo + hi) / 2;
  return (Math.pow(1 + monthly, 12) - 1) * 100;
}
