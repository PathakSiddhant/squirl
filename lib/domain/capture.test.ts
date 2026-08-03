import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCapture, type CaptureContext } from './capture';

const context: CaptureContext = {
  today: '2026-08-04', // a Tuesday
  people: [
    { id: 'p_rahul', name: 'Rahul Verma', handle: 'rahul' },
    { id: 'p_amit', name: 'Amit', handle: null },
  ],
  categories: [
    { id: 'c_chai', name: 'Chai and snacks', flow: 'out', keywords: 'chai,tea,snack,samosa,maggi' },
    { id: 'c_food', name: 'Food delivery', flow: 'out', keywords: 'zomato,swiggy,order' },
    { id: 'c_travel', name: 'Travel', flow: 'out', keywords: 'auto,uber,ola,metro,bus' },
    { id: 'c_subs', name: 'Subscriptions', flow: 'out', keywords: 'netflix,spotify,jio,recharge' },
    { id: 'c_stipend', name: 'Stipend', flow: 'in', keywords: 'stipend,salary' },
    { id: 'c_side', name: 'Side income', flow: 'in', keywords: 'freelance,gig,project' },
  ],
  accounts: [
    { id: 'a_bank', name: 'Bank', kind: 'bank' },
    { id: 'a_cash', name: 'Cash', kind: 'cash' },
    { id: 'a_parents', name: 'Parents', kind: 'parked' },
  ],
};

test('the two-word case works, because everything depends on it', () => {
  const r = parseCapture('chai 20', context);
  assert.equal(r.ok, true);
  assert.equal(r.amount, 2000);
  assert.equal(r.kind, 'expense');
  assert.equal(r.day, '2026-08-04');
  assert.equal(r.categoryId, 'c_chai');
  assert.equal(r.method, 'upi');
});

test('word order does not matter', () => {
  const a = parseCapture('chai 20', context);
  const b = parseCapture('20 chai', context);
  assert.equal(a.amount, b.amount);
  assert.equal(a.categoryId, b.categoryId);
  assert.equal(a.kind, b.kind);
});

test('method and category are picked out of a longer line', () => {
  const r = parseCapture('250 zomato upi', context);
  assert.equal(r.amount, 25000);
  assert.equal(r.categoryId, 'c_food');
  assert.equal(r.method, 'upi');
  assert.equal(r.kind, 'expense');
});

test('a leading plus makes it income', () => {
  const r = parseCapture('+5000 freelance', context);
  assert.equal(r.kind, 'income');
  assert.equal(r.amount, 500000);
  assert.equal(r.categoryId, 'c_side');
});

test('income keywords work without a sign', () => {
  const r = parseCapture('got 20000 stipend', context);
  assert.equal(r.kind, 'income');
  assert.equal(r.amount, 2000000);
  assert.equal(r.categoryId, 'c_stipend');
});

test('lending picks up a known person and does not become an expense', () => {
  const r = parseCapture('lent 1000 to rahul', context);
  assert.equal(r.kind, 'lend');
  assert.equal(r.amount, 100000);
  assert.equal(r.personId, 'p_rahul');
  assert.equal(r.newPersonName, null);
});

test('borrowing is the other direction', () => {
  const r = parseCapture('borrowed 500 from amit', context);
  assert.equal(r.kind, 'borrow');
  assert.equal(r.amount, 50000);
  assert.equal(r.personId, 'p_amit');
});

test('a repayment coming in is a collect, not income', () => {
  const r = parseCapture('rahul paid back 1000', context);
  assert.equal(r.kind, 'collect');
  assert.equal(r.personId, 'p_rahul');
  assert.equal(r.amount, 100000);
});

test('an unknown name is offered as a new person rather than dropped', () => {
  const r = parseCapture('lent 300 to nikhil', context);
  assert.equal(r.kind, 'lend');
  assert.equal(r.personId, null);
  assert.equal(r.newPersonName, 'Nikhil');
});

test('moving money to parents is a transfer to the parked account', () => {
  const r = parseCapture('moved 15000 to parents', context);
  assert.equal(r.kind, 'transfer');
  assert.equal(r.amount, 1500000);
  assert.equal(r.counterAccountId, 'a_parents');
});

test('relative days resolve against today in IST', () => {
  assert.equal(parseCapture('chai 20 yesterday', context).day, '2026-08-03');
  assert.equal(parseCapture('chai 20 kal', context).day, '2026-08-03');
  assert.equal(parseCapture('chai 20 aaj', context).day, '2026-08-04');
  assert.equal(parseCapture('500 auto 3 days ago', context).day, '2026-08-01');
});

test('a weekday always resolves backwards, never into the future', () => {
  // 2026-08-04 is a Tuesday, so "friday" means the Friday just gone.
  assert.equal(parseCapture('900 shopping friday', context).day, '2026-07-31');
  assert.equal(parseCapture('900 shopping last monday', context).day, '2026-08-03');
});

test('an explicit date is not mistaken for an amount', () => {
  const r = parseCapture('899 netflix card 2 aug', context);
  assert.equal(r.day, '2026-08-02');
  assert.equal(r.amount, 89900, 'the 2 in "2 aug" must not win the amount');
  assert.equal(r.categoryId, 'c_subs');
  assert.equal(r.method, 'card');
});

test('day-first numeric dates, the way they are written in India', () => {
  assert.equal(parseCapture('1200 groceries 12/7', context).day, '2026-07-12');
  assert.equal(parseCapture('1200 groceries 12/7/25', context).day, '2025-07-12');
  assert.equal(parseCapture('1200 groceries 2026-07-12', context).day, '2026-07-12');
});

test('a bare day and month assumes the most recent one, not the future', () => {
  // December has not happened yet in 2026, so it means last December.
  assert.equal(parseCapture('400 gift 25 dec', context).day, '2025-12-25');
  assert.equal(parseCapture('400 gift 2 aug', context).day, '2026-08-02');
});

test('k and L suffixes are understood', () => {
  assert.equal(parseCapture('1.2k rent', context).amount, 120000);
  assert.equal(parseCapture('paid 15k', context).amount, 1500000);
});

test('a line with no amount is not ok and does not invent zero', () => {
  const r = parseCapture('chai', context);
  assert.equal(r.ok, false);
  assert.equal(r.amount, null);
});

test('leftover words become the note', () => {
  const r = parseCapture('250 zomato upi biryani with roommate', context);
  assert.match(r.note, /biryani/);
  assert.match(r.note, /roommate/);
  assert.doesNotMatch(r.note, /250/);
  assert.doesNotMatch(r.note, /upi/);
});

test('every inference is reported so the UI can show and undo it', () => {
  const r = parseCapture('lent 1000 to rahul yesterday', context);
  const fields = r.matches.map((m) => m.field);
  assert.ok(fields.includes('amount'));
  assert.ok(fields.includes('kind'));
  assert.ok(fields.includes('person'));
  assert.ok(fields.includes('day'));
});

test('empty and junk input degrade quietly', () => {
  assert.equal(parseCapture('', context).ok, false);
  assert.equal(parseCapture('   ', context).ok, false);
  assert.equal(parseCapture('!!!', context).ok, false);
  assert.equal(parseCapture('0', context).ok, false, 'zero is not a transaction');
});

test('the longest matching category term wins', () => {
  const r = parseCapture('300 order zomato', context);
  assert.equal(r.categoryId, 'c_food');
});
