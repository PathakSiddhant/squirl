import type { Paise } from '../money';

/**
 * Milestones, not points.
 *
 * Every one of these is earned by doing something that genuinely improves your
 * position: clearing a debt, closing a loan, telling the truth about a balance,
 * building a stash. None of them are awarded for opening the app, because a
 * reward you cannot fail to earn is not a reward, it is decoration.
 *
 * There is deliberately no XP, no level number and no leaderboard. The point is
 * to make real progress legible, not to invent a game on top of your money.
 */

export type AchievementTier = 'start' | 'habit' | 'discipline' | 'mastery';

export interface Achievement {
  id: string;
  name: string;
  /** What you did. Past tense, plain words. */
  earnedCopy: string;
  /** What to do. Present tense, actionable. */
  goalCopy: string;
  tier: AchievementTier;
  icon: string;
}

export interface AchievementStats {
  entryCount: number;
  streak: number;
  bestStreak: number;
  parked: Paise;
  netWorth: Paise;
  debtsSettled: number;
  loansClosed: number;
  reconciliations: number;
  interestEarned: Paise;
  /** Open borrowings plus loan principal outstanding. */
  owedByMe: Paise;
  /** Days in the last 30 with at least one entry. */
  loggedDaysLast30: number;
  distinctCategoriesUsed: number;
}

export interface EarnedAchievement extends Achievement {
  earned: boolean;
  /** 0 to 1. Lets the UI show how close an unearned milestone is. */
  progress: number;
  /** e.g. "4 of 7 days". Null once earned. */
  progressLabel: string | null;
}

type Rule = Achievement & {
  /** Returns current value and the target it is measured against. */
  measure: (s: AchievementStats) => { value: number; target: number };
  format?: (value: number, target: number) => string;
};

const money = (value: number, target: number) =>
  `₹${Math.round(value).toLocaleString('en-IN')} of ₹${Math.round(target).toLocaleString('en-IN')}`;

const count = (unit: string) => (value: number, target: number) =>
  `${Math.min(value, target)} of ${target} ${unit}`;

const RULES: Rule[] = [
  {
    id: 'first-entry',
    name: 'First acorn',
    earnedCopy: 'You logged your first thing.',
    goalCopy: 'Log anything at all. Even a ₹10 chai counts.',
    tier: 'start',
    icon: 'Coffee',
    measure: (s) => ({ value: s.entryCount, target: 1 }),
    format: count('entries'),
  },
  {
    id: 'ten-entries',
    name: 'Getting the hang of it',
    earnedCopy: 'Ten things logged.',
    goalCopy: 'Log ten things, so the numbers start meaning something.',
    tier: 'start',
    icon: 'ListDashes',
    measure: (s) => ({ value: s.entryCount, target: 10 }),
    format: count('entries'),
  },
  {
    id: 'week-streak',
    name: 'A full week',
    earnedCopy: 'Seven days in a row without missing one.',
    goalCopy: 'Log something seven days running.',
    tier: 'habit',
    icon: 'Flame',
    measure: (s) => ({ value: s.bestStreak, target: 7 }),
    format: count('days'),
  },
  {
    id: 'month-streak',
    name: 'A month of knowing',
    earnedCopy: 'Thirty days straight. Nothing slipped through.',
    goalCopy: 'Keep the streak going for thirty days.',
    tier: 'discipline',
    icon: 'Flame',
    measure: (s) => ({ value: s.bestStreak, target: 30 }),
    format: count('days'),
  },
  {
    id: 'honest-books',
    name: 'Honest books',
    earnedCopy: 'You checked a balance against reality and wrote down the gap.',
    goalCopy: 'Reconcile an account against what your bank actually says.',
    tier: 'habit',
    icon: 'Scales',
    measure: (s) => ({ value: s.reconciliations, target: 1 }),
    format: count('checks'),
  },
  {
    id: 'square-up',
    name: 'Squared up',
    earnedCopy: 'You closed out a debt completely.',
    goalCopy: 'Settle one agreement with someone, all the way to zero.',
    tier: 'habit',
    icon: 'HandCoins',
    measure: (s) => ({ value: s.debtsSettled, target: 1 }),
    format: count('settled'),
  },
  {
    id: 'owe-nothing',
    name: 'Owing nobody',
    earnedCopy: 'No borrowings, no loans. Everything you hold is yours.',
    goalCopy: 'Clear every borrowing and every loan.',
    tier: 'mastery',
    icon: 'Wallet',
    // Inverted: the target is reaching zero, so progress is all-or-nothing.
    measure: (s) => ({ value: s.owedByMe === 0 && s.entryCount > 0 ? 1 : 0, target: 1 }),
  },
  {
    id: 'loan-closed',
    name: 'Loan finished',
    earnedCopy: 'You paid a loan off to the last installment.',
    goalCopy: 'Pay every installment of a loan.',
    tier: 'discipline',
    icon: 'Bank',
    measure: (s) => ({ value: s.loansClosed, target: 1 }),
    format: count('closed'),
  },
  {
    id: 'stash-5k',
    name: 'The stash begins',
    earnedCopy: 'Five thousand set aside and out of reach.',
    goalCopy: 'Park ₹5,000 somewhere you will not spend it.',
    tier: 'habit',
    icon: 'HandHeart',
    measure: (s) => ({ value: s.parked, target: 500_000 }),
    format: (v, t) => money(v / 100, t / 100),
  },
  {
    id: 'stash-50k',
    name: 'A serious stash',
    earnedCopy: 'Fifty thousand parked. That is a real cushion.',
    goalCopy: 'Build the parked pile to ₹50,000.',
    tier: 'discipline',
    icon: 'HandHeart',
    measure: (s) => ({ value: s.parked, target: 5_000_000 }),
    format: (v, t) => money(v / 100, t / 100),
  },
  {
    id: 'stash-1l',
    name: 'Six figures',
    earnedCopy: 'A full lakh, sitting where you cannot casually spend it.',
    goalCopy: 'Reach ₹1,00,000 parked.',
    tier: 'mastery',
    icon: 'HandHeart',
    measure: (s) => ({ value: s.parked, target: 10_000_000 }),
    format: (v, t) => money(v / 100, t / 100),
  },
  {
    id: 'lender',
    name: 'The bank of you',
    earnedCopy: 'You earned interest on money you lent out.',
    goalCopy: 'Earn interest on something you lent.',
    tier: 'mastery',
    icon: 'Coins',
    measure: (s) => ({ value: s.interestEarned > 0 ? 1 : 0, target: 1 }),
  },
  {
    id: 'no-blind-spots',
    name: 'No blind spots',
    earnedCopy: 'Twenty-five of the last thirty days have entries.',
    goalCopy: 'Log on at least twenty-five of the last thirty days.',
    tier: 'discipline',
    icon: 'ChartBar',
    measure: (s) => ({ value: s.loggedDaysLast30, target: 25 }),
    format: count('days'),
  },
  {
    id: 'full-picture',
    name: 'The full picture',
    earnedCopy: 'You have used eight different categories, so the breakdown is real.',
    goalCopy: 'Use eight different categories.',
    tier: 'habit',
    icon: 'Basket',
    measure: (s) => ({ value: s.distinctCategoriesUsed, target: 8 }),
    format: count('categories'),
  },
];

export function evaluateAchievements(stats: AchievementStats): EarnedAchievement[] {
  return RULES.map((rule) => {
    const { value, target } = rule.measure(stats);
    const earned = value >= target;
    return {
      id: rule.id,
      name: rule.name,
      earnedCopy: rule.earnedCopy,
      goalCopy: rule.goalCopy,
      tier: rule.tier,
      icon: rule.icon,
      earned,
      progress: target === 0 ? 1 : Math.max(0, Math.min(1, value / target)),
      progressLabel: earned ? null : (rule.format?.(value, target) ?? null),
    };
  });
}

/**
 * The single most useful thing to nudge next: closest to completion, still
 * unearned. Showing one goal beats showing fourteen.
 */
export function nextMilestone(all: EarnedAchievement[]): EarnedAchievement | null {
  const pending = all.filter((a) => !a.earned).sort((a, b) => b.progress - a.progress);
  return pending[0] ?? null;
}

export function earnedCount(all: EarnedAchievement[]): number {
  return all.filter((a) => a.earned).length;
}

/**
 * How the squirrel is doing, used for the mascot caption.
 *
 * Deliberately never scolds. The worst it says is that things are tight, which
 * is information, not judgement.
 */
export type MascotMood = 'new' | 'lean' | 'steady' | 'thriving' | 'stretched';

export function mascotMood(input: {
  entryCount: number;
  safeToSpend: Paise;
  isUnderwater: boolean;
  runwayDays: number | null;
  streak: number;
}): { mood: MascotMood; title: string; body: string } {
  if (input.entryCount === 0) {
    return {
      mood: 'new',
      title: 'Nothing stashed yet',
      body: 'Log the first thing and this whole page comes alive.',
    };
  }
  if (input.isUnderwater) {
    return {
      mood: 'stretched',
      title: 'Stretched thin',
      body: 'What you owe in the next month is more than what you are holding. Worth a plan.',
    };
  }
  if (input.runwayDays !== null && input.runwayDays < 7) {
    return {
      mood: 'lean',
      title: 'Running lean',
      body: 'At the current pace the money in hand runs out inside a week.',
    };
  }
  if (input.streak >= 7 && input.safeToSpend > 0) {
    return {
      mood: 'thriving',
      title: 'Well fed',
      body: 'Logging consistently and comfortably inside your means.',
    };
  }
  return {
    mood: 'steady',
    title: 'Steady',
    body: 'Everything promised is covered. Keep logging and the picture sharpens.',
  };
}
