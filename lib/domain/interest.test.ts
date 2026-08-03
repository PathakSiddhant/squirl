import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeDebtPosition, describeTerms, projectDebt, splitRepayment, type DebtEvent } from './interest';

const noInterest = { openedOn: '2026-01-01', interestKind: 'none' as const, rateBpsPerMonth: 0 };
const twoPctSimple = { openedOn: '2026-01-01', interestKind: 'simple' as const, rateBpsPerMonth: 200 };
const twoPctCompound = { openedOn: '2026-01-01', interestKind: 'compound' as const, rateBpsPerMonth: 200 };

const lend = (day: string, amount: number): DebtEvent => ({ type: 'principal', day, amount });
const repay = (day: string, amount: number, interestPart = 0): DebtEvent => ({
  type: 'repayment',
  day,
  amount,
  interestPart,
});

test('an interest-free loan to a friend just sits there', () => {
  const p = computeDebtPosition(noInterest, [lend('2026-01-01', 100000)], '2026-06-01');
  assert.equal(p.outstandingPrincipal, 100000);
  assert.equal(p.accruedInterest, 0);
  assert.equal(p.payoffTotal, 100000);
  assert.equal(p.isCleared, false);
});

test('simple interest accrues linearly on principal only', () => {
  // 1,000 at 2% a month for 3 months = 60 of interest.
  const p = computeDebtPosition(twoPctSimple, [lend('2026-01-01', 100000)], '2026-04-01');
  assert.equal(p.outstandingPrincipal, 100000);
  assert.equal(p.accruedInterest, 6000);
  assert.equal(p.payoffTotal, 106000);
});

test('compound interest outruns simple over the same window', () => {
  const simple = computeDebtPosition(twoPctSimple, [lend('2026-01-01', 100000)], '2026-07-01');
  const compound = computeDebtPosition(twoPctCompound, [lend('2026-01-01', 100000)], '2026-07-01');
  assert.equal(simple.accruedInterest, 12000); // 6 x 2%
  // 1000 * 1.02^6 - 1000 = 126.16
  assert.equal(compound.accruedInterest, 12616);
  assert.ok(compound.accruedInterest > simple.accruedInterest);
});

test('a second tranche accrues from its own day, not from the debt opening', () => {
  const events = [lend('2026-01-01', 100000), lend('2026-04-01', 100000)];
  const p = computeDebtPosition(twoPctSimple, events, '2026-07-01');
  assert.equal(p.outstandingPrincipal, 200000);
  // first tranche 6 months at 2%, second tranche 3 months at 2%
  assert.equal(p.accruedInterest, 12000 + 6000);
  assert.equal(p.principalAdvanced, 200000);
});

test('a repayment clears interest before it touches principal', () => {
  const events = [lend('2026-01-01', 100000), repay('2026-04-01', 6000, 6000)];
  const p = computeDebtPosition(twoPctSimple, events, '2026-04-01');
  assert.equal(p.accruedInterest, 0);
  assert.equal(p.outstandingPrincipal, 100000); // untouched, only interest was paid
  assert.equal(p.interestPaid, 6000);
  assert.equal(p.totalRepaid, 6000);
});

test('paying interest down stops it from compounding further', () => {
  const paid = computeDebtPosition(
    twoPctCompound,
    [lend('2026-01-01', 100000), repay('2026-04-01', 6121, 6121)],
    '2026-07-01',
  );
  const unpaid = computeDebtPosition(twoPctCompound, [lend('2026-01-01', 100000)], '2026-07-01');
  assert.ok(paid.accruedInterest < unpaid.accruedInterest);
});

test('a full settlement clears the debt', () => {
  const events = [lend('2026-01-01', 100000), repay('2026-04-01', 106000, 6000)];
  const p = computeDebtPosition(twoPctSimple, events, '2026-04-01');
  assert.equal(p.outstandingPrincipal, 0);
  assert.equal(p.accruedInterest, 0);
  assert.equal(p.payoffTotal, 0);
  assert.equal(p.isCleared, true);
});

test('a cleared debt stops accruing even years later', () => {
  const events = [lend('2026-01-01', 100000), repay('2026-04-01', 106000, 6000)];
  const p = computeDebtPosition(twoPctSimple, events, '2029-01-01');
  assert.equal(p.payoffTotal, 0);
});

test('partial repayment reduces the base future interest is charged on', () => {
  const events = [lend('2026-01-01', 100000), repay('2026-02-01', 52000, 2000)];
  const p = computeDebtPosition(twoPctSimple, events, '2026-03-01');
  assert.equal(p.outstandingPrincipal, 50000);
  assert.equal(p.accruedInterest, 1000); // 2% of the remaining 500 for one month
});

test('events arrive unsorted and are still replayed in order', () => {
  const jumbled = [repay('2026-04-01', 6000, 6000), lend('2026-01-01', 100000)];
  const ordered = [lend('2026-01-01', 100000), repay('2026-04-01', 6000, 6000)];
  assert.deepEqual(
    computeDebtPosition(twoPctSimple, jumbled, '2026-05-01'),
    computeDebtPosition(twoPctSimple, ordered, '2026-05-01'),
  );
});

test('events after the as-of date are ignored', () => {
  const events = [lend('2026-01-01', 100000), repay('2026-06-01', 100000, 0)];
  const p = computeDebtPosition(noInterest, events, '2026-03-01');
  assert.equal(p.outstandingPrincipal, 100000);
  assert.equal(p.totalRepaid, 0);
});

test('splitRepayment fills interest first and never over-allocates', () => {
  const p = computeDebtPosition(twoPctSimple, [lend('2026-01-01', 100000)], '2026-04-01');
  assert.deepEqual(splitRepayment(p, 6000), { interestPart: 6000, principalPart: 0 });
  assert.deepEqual(splitRepayment(p, 106000), { interestPart: 6000, principalPart: 100000 });
  // A tiny payment cannot allocate more interest than was actually paid.
  assert.deepEqual(splitRepayment(p, 1000), { interestPart: 1000, principalPart: 0 });
});

test('projectDebt looks forward without mutating the present', () => {
  const events = [lend('2026-01-01', 100000)];
  const nowValue = computeDebtPosition(twoPctSimple, events, '2026-04-01').payoffTotal;
  assert.equal(projectDebt(twoPctSimple, events, '2026-04-01', '2026-07-01'), 106000 + 6000);
  assert.equal(projectDebt(twoPctSimple, events, '2026-04-01', '2026-01-01'), nowValue);
});

test('describeTerms reads like a sentence', () => {
  assert.equal(describeTerms(noInterest), 'no interest');
  assert.equal(describeTerms(twoPctSimple), '2% a month, simple');
  assert.equal(describeTerms(twoPctCompound), '2% a month, compounding');
});
