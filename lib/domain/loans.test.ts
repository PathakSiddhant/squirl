import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSchedule, effectiveAnnualRatePct, scheduleTotals, type LoanSpec } from './loans';
import { sum } from '../money';

// The exact case from the brief: borrow 1,500, repay 550 a month for 3 months.
const appLoan: LoanSpec = {
  principal: 150000,
  tenureMonths: 3,
  firstDueOn: '2026-09-01',
  interestModel: 'emi_known',
  emiAmount: 55000,
};

test('the brief loan produces the schedule the user was quoted', () => {
  const schedule = buildSchedule(appLoan);
  assert.equal(schedule.length, 3);
  assert.deepEqual(
    schedule.map((s) => s.amount),
    [55000, 55000, 55000],
  );
  assert.deepEqual(
    schedule.map((s) => s.dueOn),
    ['2026-09-01', '2026-10-01', '2026-11-01'],
  );

  const totals = scheduleTotals(schedule);
  assert.equal(totals.principal, 150000);
  assert.equal(totals.interest, 15000); // 1650 repaid on 1500 borrowed
  assert.equal(totals.total, 165000);
});

test('principal always sums back to exactly the principal', () => {
  const cases: LoanSpec[] = [
    appLoan,
    { principal: 100000, tenureMonths: 7, firstDueOn: '2026-01-01', interestModel: 'emi_known', emiAmount: 15500 },
    { principal: 999, tenureMonths: 3, firstDueOn: '2026-01-31', interestModel: 'emi_known', emiAmount: 400 },
    { principal: 5000000, tenureMonths: 24, firstDueOn: '2026-03-15', interestModel: 'flat', rateBpsPerAnnum: 1400 },
    { principal: 5000000, tenureMonths: 24, firstDueOn: '2026-03-15', interestModel: 'reducing', rateBpsPerAnnum: 1400 },
    { principal: 123457, tenureMonths: 11, firstDueOn: '2026-05-31', interestModel: 'reducing', rateBpsPerAnnum: 2399 },
    { principal: 60000, tenureMonths: 4, firstDueOn: '2026-02-01', interestModel: 'none' },
  ];

  for (const spec of cases) {
    const schedule = buildSchedule(spec);
    const totals = scheduleTotals(schedule);
    assert.equal(totals.principal, spec.principal, `principal for ${spec.interestModel}/${spec.tenureMonths}`);
    assert.equal(
      totals.total,
      totals.principal + totals.interest,
      `amounts reconcile for ${spec.interestModel}`,
    );
    assert.equal(schedule.length, spec.tenureMonths);
    assert.ok(
      schedule.every((s) => s.amount > 0 && s.principalPart >= 0 && s.interestPart >= 0),
      'no negative or empty installment',
    );
  }
});

test('due dates clamp into short months instead of overflowing', () => {
  const schedule = buildSchedule({
    principal: 300000,
    tenureMonths: 4,
    firstDueOn: '2026-01-31',
    interestModel: 'none',
  });
  assert.deepEqual(
    schedule.map((s) => s.dueOn),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
  );
});

test('an interest-free split carries no interest at all', () => {
  const schedule = buildSchedule({
    principal: 60000,
    tenureMonths: 4,
    firstDueOn: '2026-02-01',
    interestModel: 'none',
  });
  assert.equal(scheduleTotals(schedule).interest, 0);
  assert.deepEqual(
    schedule.map((s) => s.amount),
    [15000, 15000, 15000, 15000],
  );
});

test('a reducing-balance loan front-loads interest and ends on zero', () => {
  const schedule = buildSchedule({
    principal: 1200000,
    tenureMonths: 12,
    firstDueOn: '2026-01-01',
    interestModel: 'reducing',
    rateBpsPerAnnum: 1200,
  });

  assert.ok(schedule[0].interestPart > schedule[11].interestPart, 'interest shrinks over the tenure');
  assert.ok(schedule[0].principalPart < schedule[11].principalPart, 'principal grows over the tenure');
  assert.equal(sum(schedule.map((s) => s.principalPart)), 1200000);
  // First month's interest is exactly 1% of the opening balance.
  assert.equal(schedule[0].interestPart, 12000);
});

test('an EMI below the plain split is treated as a slip, not negative interest', () => {
  const schedule = buildSchedule({
    principal: 150000,
    tenureMonths: 3,
    firstDueOn: '2026-01-01',
    interestModel: 'emi_known',
    emiAmount: 10000, // far too low
  });
  assert.equal(scheduleTotals(schedule).interest, 0);
  assert.equal(scheduleTotals(schedule).principal, 150000);
});

test('degenerate inputs produce an empty schedule rather than throwing', () => {
  assert.deepEqual(buildSchedule({ ...appLoan, tenureMonths: 0 }), []);
  assert.deepEqual(buildSchedule({ ...appLoan, principal: 0 }), []);
});

test('effective annual rate exposes what the app loan really costs', () => {
  // 1,500 repaid as 550 x 3 looks like "only 150 extra", but the principal is
  // shrinking the whole time, so the real cost is about 78% a year.
  const rate = effectiveAnnualRatePct(150000, 55000, 3);
  assert.ok(rate !== null, 'a rate is solvable');
  assert.ok(rate > 75 && rate < 81, `expected roughly 78% APR, got ${rate}`);

  // Sanity anchor: a 12% reducing-balance loan must solve back to about 12%.
  const benchmark = effectiveAnnualRatePct(1200000, 106619, 12);
  assert.ok(benchmark !== null && Math.abs(benchmark - 12.68) < 0.5, `got ${benchmark}`);

  assert.equal(effectiveAnnualRatePct(150000, 50000, 3), 0); // exactly principal back
  assert.equal(effectiveAnnualRatePct(0, 5000, 3), null);
});
