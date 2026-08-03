import assert from 'node:assert/strict';
import { test } from 'node:test';

import { atLeastZero, distribute, formatCompact, formatMoney, parseAmount, sum, toPaise } from './money';

test('toPaise rounds instead of truncating', () => {
  assert.equal(toPaise(1200), 120000);
  assert.equal(toPaise(0.1 + 0.2), 30); // the float trap
  assert.equal(toPaise(12.005), 1201);
  assert.equal(toPaise(-45.5), -4550);
});

test('parseAmount accepts what a human actually types', () => {
  assert.equal(parseAmount('20'), 2000);
  assert.equal(parseAmount('₹1,200'), 120000);
  assert.equal(parseAmount(' 1200.50 '), 120050);
  assert.equal(parseAmount('1.2k'), 120000);
  assert.equal(parseAmount('2L'), 20000000);
  assert.equal(parseAmount('-350'), -35000);
});

test('parseAmount rejects non-amounts without pretending they are zero', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('chai'), null);
  assert.equal(parseAmount('12ab'), null);
  assert.equal(parseAmount('1.2.3'), null);
});

test('formatMoney groups the Indian way and hides empty paise', () => {
  assert.equal(formatMoney(120000), '₹1,200');
  assert.equal(formatMoney(2000000), '₹20,000');
  assert.equal(formatMoney(150000000), '₹15,00,000'); // lakh grouping, not thousands
  assert.equal(formatMoney(120050), '₹1,200.50');
  assert.equal(formatMoney(-35000), '-₹350');
  assert.equal(formatMoney(120000, { signed: true }), '+₹1,200');
  assert.equal(formatMoney(120000, { bare: true }), '1,200');
});

test('formatCompact stays readable in tight columns', () => {
  assert.equal(formatCompact(95000), '950');
  assert.equal(formatCompact(1250000), '12.5k');
  assert.equal(formatCompact(2000000), '20k');
  assert.equal(formatCompact(25000000), '2.5L');
});

test('distribute never loses or invents a paisa', () => {
  const parts = distribute(100000, 3);
  assert.deepEqual(parts, [33334, 33333, 33333]);
  assert.equal(sum(parts), 100000);

  for (const total of [1, 7, 999, 150000, 1_23_456]) {
    for (const n of [1, 2, 3, 5, 12]) {
      assert.equal(sum(distribute(total, n)), total, `${total} over ${n}`);
    }
  }
});

test('sum ignores holes rather than producing NaN', () => {
  assert.equal(sum([100, null, 200, undefined]), 300);
  assert.equal(sum([]), 0);
});

test('atLeastZero floors at zero', () => {
  assert.equal(atLeastZero(-500), 0);
  assert.equal(atLeastZero(500), 500);
});
