import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  accountBalances,
  accountDelta,
  burnRate,
  computePosition,
  computeRunway,
  dailyAllowance,
  loggingStreak,
  summariseDays,
  type AccountSeed,
  type Commitment,
  type LedgerMovement,
} from './position';

const accounts: AccountSeed[] = [
  { id: 'bank', kind: 'bank', openingBalance: 0 },
  { id: 'cash', kind: 'cash', openingBalance: 0 },
  { id: 'parents', kind: 'parked', openingBalance: 0 },
];

const move = (
  day: string,
  kind: LedgerMovement['kind'],
  amount: number,
  accountId: string | null = 'bank',
  counterAccountId: string | null = null,
): LedgerMovement => ({ day, kind, amount, accountId, counterAccountId });

// The brief, as a ledger: stipend in, 15k to parents, some spending.
const brief: LedgerMovement[] = [
  move('2026-08-01', 'income', 2000000),
  move('2026-08-01', 'transfer', 1500000, 'bank', 'parents'),
  move('2026-08-02', 'expense', 25000),
  move('2026-08-03', 'expense', 2000),
];

test('a transfer to parents moves money without spending it', () => {
  const balances = accountBalances(accounts, brief, '2026-08-03');
  assert.equal(balances.get('bank'), 2000000 - 1500000 - 25000 - 2000);
  assert.equal(balances.get('parents'), 1500000);
});

test('accountDelta signs every movement kind correctly', () => {
  assert.equal(accountDelta(move('d', 'income', 100), 'bank'), 100);
  assert.equal(accountDelta(move('d', 'expense', 100), 'bank'), -100);
  assert.equal(accountDelta(move('d', 'lend', 100), 'bank'), -100);
  assert.equal(accountDelta(move('d', 'borrow', 100), 'bank'), 100);
  assert.equal(accountDelta(move('d', 'collect', 100), 'bank'), 100);
  assert.equal(accountDelta(move('d', 'settle', 100), 'bank'), -100);
  assert.equal(accountDelta(move('d', 'loan_taken', 100), 'bank'), 100);
  assert.equal(accountDelta(move('d', 'loan_payment', 100), 'bank'), -100);
  assert.equal(accountDelta(move('d', 'adjust_up', 100), 'bank'), 100);
  assert.equal(accountDelta(move('d', 'adjust_down', 100), 'bank'), -100);

  const transfer = move('d', 'transfer', 100, 'bank', 'parents');
  assert.equal(accountDelta(transfer, 'bank'), -100);
  assert.equal(accountDelta(transfer, 'parents'), 100);
  assert.equal(accountDelta(transfer, 'cash'), 0);
});

test('balances ignore anything dated after the as-of day', () => {
  const balances = accountBalances(accounts, brief, '2026-08-01');
  assert.equal(balances.get('bank'), 500000);
});

test('lending leaves net worth intact but takes the money out of hand', () => {
  const movements = [...brief, move('2026-08-04', 'lend', 100000)];
  const position = computePosition({
    asOf: '2026-08-04',
    accounts,
    movements,
    owedToMe: 100000,
    owedByMeToPeople: 0,
    loanPrincipalOutstanding: 0,
    commitments: [],
    buffer: 0,
    horizonDays: 30,
  });

  const before = computePosition({
    asOf: '2026-08-03',
    accounts,
    movements: brief,
    owedToMe: 0,
    owedByMeToPeople: 0,
    loanPrincipalOutstanding: 0,
    commitments: [],
    buffer: 0,
    horizonDays: 30,
  });

  assert.equal(position.netWorth, before.netWorth, 'net worth unchanged by lending');
  assert.equal(position.inHand, before.inHand - 100000, 'in hand drops by what was lent');
  assert.equal(position.owedToMe, 100000);
});

test('parked money counts toward net worth but never toward safe to spend', () => {
  const position = computePosition({
    asOf: '2026-08-03',
    accounts,
    movements: brief,
    owedToMe: 0,
    owedByMeToPeople: 0,
    loanPrincipalOutstanding: 0,
    commitments: [],
    buffer: 0,
    horizonDays: 30,
  });

  assert.equal(position.parked, 1500000);
  assert.equal(position.inHand, 473000);
  assert.equal(position.netWorth, 1973000);
  assert.equal(position.safeToSpend, 473000, 'the 15k with parents is not spendable');
});

test('commitments inside the horizon reduce what is safe to spend', () => {
  const commitments: Commitment[] = [
    { id: 'i1', label: 'EMI 1 of 3', dueOn: '2026-08-20', amount: 55000, source: 'installment', isOverdue: false },
    { id: 'i2', label: 'EMI 2 of 3', dueOn: '2026-09-20', amount: 55000, source: 'installment', isOverdue: false },
    { id: 'i3', label: 'EMI 3 of 3', dueOn: '2026-10-20', amount: 55000, source: 'installment', isOverdue: false },
  ];

  const position = computePosition({
    asOf: '2026-08-03',
    accounts,
    movements: brief,
    owedToMe: 0,
    owedByMeToPeople: 0,
    loanPrincipalOutstanding: 110000,
    commitments,
    buffer: 0,
    horizonDays: 30,
  });

  // Only the EMIs inside 30 days count: 20 Aug and 2 Sep is past, so one only.
  assert.equal(position.commitments.length, 1);
  assert.equal(position.committed, 55000);
  assert.equal(position.safeToSpend, 473000 - 55000);
  assert.equal(position.iOwe, 110000);
});

test('an overdue commitment still counts however far back it slipped', () => {
  const commitments: Commitment[] = [
    { id: 'old', label: 'EMI, missed', dueOn: '2026-05-01', amount: 55000, source: 'installment', isOverdue: true },
  ];
  const position = computePosition({
    asOf: '2026-08-03',
    accounts,
    movements: brief,
    owedToMe: 0,
    owedByMeToPeople: 0,
    loanPrincipalOutstanding: 55000,
    commitments,
    buffer: 0,
    horizonDays: 30,
  });
  assert.equal(position.committed, 55000);
});

test('the buffer is subtracted and shortfall is reported when underwater', () => {
  const position = computePosition({
    asOf: '2026-08-03',
    accounts,
    movements: brief,
    owedToMe: 0,
    owedByMeToPeople: 0,
    loanPrincipalOutstanding: 0,
    commitments: [
      { id: 'x', label: 'rent', dueOn: '2026-08-10', amount: 500000, source: 'recurring', isOverdue: false },
    ],
    buffer: 50000,
    horizonDays: 30,
  });

  assert.equal(position.safeToSpend, 0, 'never reports a negative amount as spendable');
  assert.equal(position.isUnderwater, true);
  assert.equal(position.shortfall, 500000 + 50000 - 473000);
});

test('burn rate counts spending only, not lending or transfers', () => {
  const movements = [
    move('2026-08-01', 'expense', 70000),
    move('2026-08-02', 'lend', 500000),
    move('2026-08-03', 'transfer', 1500000, 'bank', 'parents'),
    move('2026-08-04', 'loan_payment', 55000),
  ];
  // 700 spent across a 7 day window is 100 a day.
  assert.equal(burnRate(movements, '2026-08-07', 7), 10000);
});

test('runway divides what is in hand by the burn rate', () => {
  const position = computePosition({
    asOf: '2026-08-03',
    accounts,
    movements: brief,
    owedToMe: 0,
    owedByMeToPeople: 0,
    loanPrincipalOutstanding: 0,
    commitments: [],
    buffer: 0,
    horizonDays: 30,
  });

  const runway = computeRunway(position, 10000); // 100 a day against 4,730
  assert.equal(runway.days, 47);
  assert.equal(runway.emptyOn, '2026-09-19');

  assert.deepEqual(computeRunway(position, 0), { days: null, emptyOn: null, dailyBurn: 0 });
});

test('daily allowance stretches to the next money arriving', () => {
  const position = computePosition({
    asOf: '2026-08-03',
    accounts,
    movements: brief,
    owedToMe: 0,
    owedByMeToPeople: 0,
    loanPrincipalOutstanding: 0,
    commitments: [],
    buffer: 0,
    horizonDays: 30,
  });

  // 4,730 across the 29 days to the next stipend.
  const untilStipend = dailyAllowance(position, '2026-09-01');
  assert.equal(untilStipend.days, 29);
  assert.equal(untilStipend.perDay, Math.floor(473000 / 29));

  // With nothing expected it falls back to the horizon rather than dividing by zero.
  const fallback = dailyAllowance(position, null);
  assert.equal(fallback.untilDay, '2026-09-02');
  assert.ok(fallback.perDay > 0);
});

test('day summaries exclude transfers so charts do not double count', () => {
  const summaries = summariseDays(brief);
  assert.equal(summaries.get('2026-08-01')?.in, 2000000);
  assert.equal(summaries.get('2026-08-01')?.out, 0, 'the 15k to parents is not spending');
  assert.equal(summaries.get('2026-08-01')?.count, 1);
  assert.equal(summaries.get('2026-08-02')?.out, 25000);
  assert.equal(summaries.get('2026-08-02')?.net, -25000);
});

test('the logging streak survives a day that has not been logged yet', () => {
  const logged = new Set(['2026-08-01', '2026-08-02', '2026-08-03']);
  assert.equal(loggingStreak(logged, '2026-08-03'), 3);
  assert.equal(loggingStreak(logged, '2026-08-04'), 3, 'today is still in progress');
  assert.equal(loggingStreak(logged, '2026-08-05'), 0, 'a full day missed breaks it');
  assert.equal(loggingStreak(new Set(), '2026-08-03'), 0);
});
