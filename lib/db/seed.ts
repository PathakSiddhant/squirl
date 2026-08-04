import { eq } from 'drizzle-orm';

import { addDays, addMonths, today as istToday, type DayString } from '../date';
import { buildSchedule } from '../domain/loans';
import { db } from './client';
import { newId } from './id';
import { SEED_ACCOUNTS, SEED_CATEGORIES, SEED_SETTINGS } from './seed-data';
import {
  accounts,
  categories,
  debts,
  installments,
  loans,
  people,
  recurring,
  settings,
  transactions,
} from './schema';

/**
 * Seeds a fresh ledger.
 *
 * Plain `npm run db:seed` writes only the scaffolding: accounts, categories and
 * defaults. `npm run db:demo` additionally writes four months of a plausible
 * intern's money, so someone cloning the repo can see what the app is for
 * without typing a hundred rows first.
 */

const isDemo = process.argv.includes('--demo');

// A tiny seeded PRNG, so the demo dataset is identical on every machine.
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

async function main() {
  const existing = await db.select({ id: accounts.id }).from(accounts).limit(1);
  if (existing.length > 0 && !process.argv.includes('--force')) {
    console.log('ledger already has accounts, nothing to do (pass --force to add anyway)');
    return;
  }

  const accountIds = new Map<string, string>();
  for (const account of SEED_ACCOUNTS) {
    const id = newId('acc');
    accountIds.set(account.key, id);
    await db.insert(accounts).values({
      id,
      name: account.name,
      kind: account.kind,
      note: account.note,
      sortOrder: account.sortOrder,
      openingBalance: 0,
    });
  }

  const categoryIds = new Map<string, string>();
  for (const [index, category] of SEED_CATEGORIES.entries()) {
    const id = newId('cat');
    categoryIds.set(category.key, id);
    await db.insert(categories).values({
      id,
      name: category.name,
      flow: category.flow,
      icon: category.icon,
      keywords: category.keywords,
      sortOrder: index,
      isSystem: true,
    });
  }

  for (const [key, value] of Object.entries(SEED_SETTINGS)) {
    await db.insert(settings).values({ key, value });
  }

  console.log(`seeded ${SEED_ACCOUNTS.length} accounts, ${SEED_CATEGORIES.length} categories`);

  if (!isDemo) {
    console.log('done. run `npm run db:demo` instead if you want sample data.');
    return;
  }

  await seedDemo(accountIds, categoryIds);
}

async function seedDemo(accountIds: Map<string, string>, categoryIds: Map<string, string>) {
  const random = makeRandom(20260804);
  const now = istToday();
  const bank = accountIds.get('bank')!;
  const cash = accountIds.get('cash')!;
  const savings = accountIds.get('savings')!;
  const cat = (key: string) => categoryIds.get(key)!;

  const rows: Array<typeof transactions.$inferInsert> = [];
  const push = (row: Omit<typeof transactions.$inferInsert, 'id'>) =>
    rows.push({ id: newId('txn'), ...row });

  // ---- people ------------------------------------------------------------
  const rahul = newId('per');
  const amit = newId('per');
  const sneha = newId('per');
  await db.insert(people).values([
    { id: rahul, name: 'Rahul', handle: 'rahul', note: 'Roommate' },
    { id: amit, name: 'Amit', handle: 'amit', note: 'From college' },
    { id: sneha, name: 'Sneha', handle: 'sneha', note: 'Team lead at work' },
  ]);

  // ---- four months of stipend, parking and living -------------------------
  const startMonth = addMonths(now, -3);
  const stipendDays: DayString[] = [];

  for (let m = 0; m < 4; m += 1) {
    const monthStart = addMonths(startMonth, m);
    const stipendDay = `${monthStart.slice(0, 7)}-03`;
    if (stipendDay > now) break;
    stipendDays.push(stipendDay);

    push({
      day: stipendDay,
      kind: 'income',
      amount: 2000000,
      accountId: bank,
      categoryId: cat('stipend'),
      method: 'bank',
      note: 'Monthly stipend',
    });

    const parkDay = addDays(stipendDay, 1);
    if (parkDay <= now) {
      push({
        day: parkDay,
        kind: 'transfer',
        amount: 1500000,
        accountId: bank,
        counterAccountId: savings,
        method: 'upi',
        note: 'Set aside so it does not get spent',
      });
    }
  }

  // Everyday spending: mostly small UPI taps, tuned so the month lands close
  // to the 5,000 that actually stays in hand rather than inventing a deficit.
  const spendPlan: Array<[string, number, number, number]> = [
    // category, minimum, maximum, chance per day
    ['chai', 1000, 5000, 0.8],
    ['travel', 2000, 7000, 0.45],
    ['food', 15000, 29000, 0.18],
    ['eatout', 20000, 40000, 0.08],
    ['groceries', 12000, 28000, 0.1],
    ['fun', 20000, 50000, 0.04],
    ['shopping', 30000, 90000, 0.03],
    ['health', 8000, 30000, 0.03],
  ];

  for (let day = startMonth; day <= now; day = addDays(day, 1)) {
    for (const [key, min, max, chance] of spendPlan) {
      if (random() > chance) continue;
      const amount = Math.round((min + random() * (max - min)) / 100) * 100;
      push({
        day,
        kind: 'expense',
        amount,
        accountId: random() > 0.15 ? bank : cash,
        categoryId: cat(key),
        method: random() > 0.2 ? 'upi' : random() > 0.5 ? 'cash' : 'card',
      });
    }
  }

  // Fixed monthly outgoings.
  for (const stipendDay of stipendDays) {
    push({
      day: addDays(stipendDay, 2),
      kind: 'expense',
      amount: 29900,
      accountId: bank,
      categoryId: cat('phone'),
      method: 'upi',
      note: 'Recharge',
    });
    push({
      day: addDays(stipendDay, 4),
      kind: 'expense',
      amount: 64900,
      accountId: bank,
      categoryId: cat('subs'),
      method: 'card',
      note: 'Netflix and Spotify',
    });
  }

  // Cash has to come from somewhere. Without withdrawals the cash account
  // drifts negative, which is impossible in real life and makes the demo lie.
  for (let day = addDays(startMonth, 6); day <= now; day = addDays(day, 12)) {
    push({
      day,
      kind: 'transfer',
      amount: 40000,
      accountId: bank,
      counterAccountId: cash,
      method: 'bank',
      note: 'ATM',
    });
  }

  // The unpredictable extra money the brief mentions.
  push({
    day: addDays(now, -5),
    kind: 'income',
    amount: 450000,
    accountId: bank,
    categoryId: cat('side'),
    method: 'upi',
    note: 'Poster design for a friend',
  });
  const topUpDay = addDays(now, -9);
  push({
    day: topUpDay,
    kind: 'transfer',
    amount: 300000,
    accountId: savings,
    counterAccountId: bank,
    method: 'upi',
    note: 'Pulled a bit back from savings',
  });

  // ---- lending and borrowing ---------------------------------------------
  const lentToRahul = newId('debt');
  const lentOpenedOn = addDays(now, -74);
  await db.insert(debts).values({
    id: lentToRahul,
    personId: rahul,
    direction: 'lent',
    openedOn: lentOpenedOn,
    dueOn: addDays(now, 26),
    interestKind: 'none',
    rateBpsPerMonth: 0,
    status: 'open',
    note: 'For his laptop repair',
  });
  push({
    day: lentOpenedOn,
    kind: 'lend',
    amount: 200000,
    accountId: bank,
    personId: rahul,
    debtId: lentToRahul,
    method: 'upi',
  });
  push({
    day: addDays(now, -20),
    kind: 'collect',
    amount: 80000,
    accountId: bank,
    personId: rahul,
    debtId: lentToRahul,
    method: 'upi',
    note: 'First chunk back',
  });

  const lentToSneha = newId('debt');
  const snehaOpenedOn = addDays(now, -46);
  await db.insert(debts).values({
    id: lentToSneha,
    personId: sneha,
    direction: 'lent',
    openedOn: snehaOpenedOn,
    dueOn: addDays(now, 45),
    interestKind: 'simple',
    rateBpsPerMonth: 150,
    status: 'open',
    note: 'She insisted on paying interest',
  });
  push({
    day: snehaOpenedOn,
    kind: 'lend',
    amount: 250000,
    accountId: bank,
    personId: sneha,
    debtId: lentToSneha,
    method: 'bank',
  });

  const borrowedFromAmit = newId('debt');
  const amitOpenedOn = addDays(now, -17);
  await db.insert(debts).values({
    id: borrowedFromAmit,
    personId: amit,
    direction: 'borrowed',
    openedOn: amitOpenedOn,
    dueOn: addDays(now, 13),
    interestKind: 'none',
    rateBpsPerMonth: 0,
    status: 'open',
    note: 'Covered me when the stipend was late',
  });
  push({
    day: amitOpenedOn,
    kind: 'borrow',
    amount: 250000,
    accountId: bank,
    personId: amit,
    debtId: borrowedFromAmit,
    method: 'upi',
  });

  // ---- the app loan from the brief ---------------------------------------
  const loanId = newId('loan');
  const takenOn = addDays(now, -38);
  const firstDueOn = addMonths(takenOn, 1);
  await db.insert(loans).values({
    id: loanId,
    lender: 'Kissht',
    principal: 150000,
    takenOn,
    tenureMonths: 3,
    interestModel: 'emi_known',
    emiAmount: 55000,
    firstDueOn,
    status: 'active',
    note: 'Borrow 1500, pay 550 a month for 3 months',
  });
  push({
    day: takenOn,
    kind: 'loan_taken',
    amount: 150000,
    accountId: bank,
    loanId,
    method: 'bank',
    note: 'Disbursed',
  });

  const schedule = buildSchedule({
    principal: 150000,
    tenureMonths: 3,
    firstDueOn,
    interestModel: 'emi_known',
    emiAmount: 55000,
  });

  for (const item of schedule) {
    const installmentId = newId('inst');
    const isPaid = item.dueOn <= now;
    await db.insert(installments).values({
      id: installmentId,
      loanId,
      seq: item.seq,
      dueOn: item.dueOn,
      amount: item.amount,
      principalPart: item.principalPart,
      interestPart: item.interestPart,
      status: isPaid ? 'paid' : 'due',
      paidOn: isPaid ? item.dueOn : null,
    });
    if (isPaid) {
      push({
        day: item.dueOn,
        kind: 'loan_payment',
        amount: item.amount,
        interestPart: item.interestPart,
        accountId: bank,
        loanId,
        installmentId,
        method: 'auto',
        note: `EMI ${item.seq} of ${schedule.length}`,
      });
    }
  }

  // ---- recurring commitments ---------------------------------------------
  await db.insert(recurring).values([
    {
      id: newId('rec'),
      name: 'Stipend',
      kind: 'income',
      amount: 2000000,
      accountId: bank,
      categoryId: cat('stipend'),
      cadence: 'monthly',
      anchor: 3,
      nextDueOn: nextAnchor(now, 3),
      method: 'bank',
      active: true,
    },
    {
      id: newId('rec'),
      name: 'Set aside',
      kind: 'transfer',
      amount: 1500000,
      accountId: bank,
      counterAccountId: savings,
      cadence: 'monthly',
      anchor: 4,
      nextDueOn: nextAnchor(now, 4),
      method: 'upi',
      active: true,
    },
  ]);

  await db.insert(transactions).values(rows);
  await db.update(settings).set({ value: 'true' }).where(eq(settings.key, 'onboarded'));

  console.log(`demo ledger written: ${rows.length} transactions, 3 people, 3 debts, 1 loan`);
}

function nextAnchor(from: DayString, dayOfMonth: number): DayString {
  const thisMonth = `${from.slice(0, 7)}-${`${dayOfMonth}`.padStart(2, '0')}`;
  return thisMonth > from ? thisMonth : addMonths(thisMonth, 1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('seed failed');
    console.error(error);
    process.exit(1);
  });
