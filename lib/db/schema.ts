import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * One ledger, five kinds of money.
 *
 * The central idea: `transactions` is the only place money moves. Debts, loans
 * and balances are never stored as running totals, because a stored total and a
 * ledger will eventually disagree and there is no way to tell which one lied.
 * Everything is derived from the movements.
 */

const now = () => Date.now();

// ---------------------------------------------------------------- accounts

/**
 * `parked` is the load-bearing account kind. Money sent to parents is not
 * spent, it is moved somewhere deliberately hard to reach. It still counts
 * toward net worth but never toward what is safe to spend today.
 */
export const ACCOUNT_KINDS = ['bank', 'cash', 'wallet', 'parked'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ACCOUNT_KINDS }).notNull(),
    openingBalance: integer('opening_balance').notNull().default(0),
    note: text('note'),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: integer('archived_at'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('accounts_kind_idx').on(t.kind), index('accounts_sort_idx').on(t.sortOrder)],
);

// -------------------------------------------------------------- categories

export const CATEGORY_FLOWS = ['out', 'in'] as const;
export type CategoryFlow = (typeof CATEGORY_FLOWS)[number];

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    flow: text('flow', { enum: CATEGORY_FLOWS }).notNull(),
    /** Phosphor icon name, resolved through a whitelist at render time. */
    icon: text('icon').notNull().default('Circle'),
    /** Keywords the quick-capture parser matches against, comma separated. */
    keywords: text('keywords').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
    archivedAt: integer('archived_at'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('categories_flow_idx').on(t.flow)],
);

// ------------------------------------------------------------------ people

export const people = sqliteTable(
  'people',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Optional shorthand typed in quick capture, e.g. "rahul". */
    handle: text('handle'),
    note: text('note'),
    archivedAt: integer('archived_at'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex('people_handle_idx').on(t.handle)],
);

// ------------------------------------------------------------------- debts

export const DEBT_DIRECTIONS = ['lent', 'borrowed'] as const;
export type DebtDirection = (typeof DEBT_DIRECTIONS)[number];

export const INTEREST_KINDS = ['none', 'simple', 'compound'] as const;
export type InterestKind = (typeof INTEREST_KINDS)[number];

export const DEBT_STATUSES = ['open', 'settled', 'written_off'] as const;
export type DebtStatus = (typeof DEBT_STATUSES)[number];

/**
 * A debt row holds only the *terms*. Principal and repayments live in
 * `transactions`, so lending another 500 to the same person on the same
 * agreement is just another movement rather than an edit to a total.
 *
 * Rates are basis points per month: 100 bps = 1.00% per month. Integers, so
 * a rate never picks up float dust.
 */
export const debts = sqliteTable(
  'debts',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    direction: text('direction', { enum: DEBT_DIRECTIONS }).notNull(),
    openedOn: text('opened_on').notNull(),
    dueOn: text('due_on'),
    interestKind: text('interest_kind', { enum: INTEREST_KINDS }).notNull().default('none'),
    rateBpsPerMonth: integer('rate_bps_per_month').notNull().default(0),
    status: text('status', { enum: DEBT_STATUSES }).notNull().default('open'),
    closedOn: text('closed_on'),
    note: text('note'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [
    index('debts_person_idx').on(t.personId),
    index('debts_status_idx').on(t.status),
    check('debts_rate_nonneg', sql`${t.rateBpsPerMonth} >= 0`),
  ],
);

// ------------------------------------------------------------------- loans

export const LOAN_INTEREST_MODELS = ['emi_known', 'flat', 'reducing', 'none'] as const;
export type LoanInterestModel = (typeof LOAN_INTEREST_MODELS)[number];

export const LOAN_STATUSES = ['active', 'closed', 'foreclosed'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

/**
 * A formal loan from an app or a lender, repaid on a fixed schedule.
 *
 * `emi_known` is the default because that is how these products are actually
 * sold: "borrow 1,500, pay 550 a month for 3 months". The interest is whatever
 * falls out of that, and the app should not force the user to compute a rate
 * they were never told.
 */
export const loans = sqliteTable(
  'loans',
  {
    id: text('id').primaryKey(),
    lender: text('lender').notNull(),
    principal: integer('principal').notNull(),
    takenOn: text('taken_on').notNull(),
    tenureMonths: integer('tenure_months').notNull(),
    interestModel: text('interest_model', { enum: LOAN_INTEREST_MODELS }).notNull().default('emi_known'),
    /** Only meaningful for flat / reducing. Basis points per annum. */
    rateBpsPerAnnum: integer('rate_bps_per_annum').notNull().default(0),
    /** Only meaningful for emi_known. */
    emiAmount: integer('emi_amount').notNull().default(0),
    processingFee: integer('processing_fee').notNull().default(0),
    firstDueOn: text('first_due_on').notNull(),
    status: text('status', { enum: LOAN_STATUSES }).notNull().default('active'),
    closedOn: text('closed_on'),
    note: text('note'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [
    index('loans_status_idx').on(t.status),
    check('loans_tenure_positive', sql`${t.tenureMonths} > 0`),
    check('loans_principal_positive', sql`${t.principal} > 0`),
  ],
);

export const INSTALLMENT_STATUSES = ['due', 'paid', 'skipped'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const installments = sqliteTable(
  'installments',
  {
    id: text('id').primaryKey(),
    loanId: text('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    dueOn: text('due_on').notNull(),
    amount: integer('amount').notNull(),
    principalPart: integer('principal_part').notNull(),
    interestPart: integer('interest_part').notNull(),
    status: text('status', { enum: INSTALLMENT_STATUSES }).notNull().default('due'),
    paidOn: text('paid_on'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex('installments_loan_seq_idx').on(t.loanId, t.seq),
    index('installments_due_idx').on(t.dueOn),
    index('installments_status_idx').on(t.status),
  ],
);

// ------------------------------------------------------------ transactions

/**
 * Every way money can move. Amounts are always positive; direction is carried
 * by the kind, so no row can be ambiguous about which way the rupees went.
 *
 *   income        money arrived from outside      + account
 *   expense       money spent                     - account
 *   transfer      moved between own accounts      - from, + to
 *   lend          lent to a person                - account, receivable up
 *   borrow        borrowed from a person          + account, payable up
 *   collect       a person paid me back           + account, receivable down
 *   settle        I paid a person back            - account, payable down
 *   loan_taken    a loan was disbursed to me      + account, loan liability up
 *   loan_payment  an installment was paid         - account, loan principal down
 *   adjust_up     reconciliation, found money     + account
 *   adjust_down   reconciliation, money missing   - account
 */
export const TRANSACTION_KINDS = [
  'income',
  'expense',
  'transfer',
  'lend',
  'borrow',
  'collect',
  'settle',
  'loan_taken',
  'loan_payment',
  'adjust_up',
  'adjust_down',
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const PAYMENT_METHODS = ['upi', 'card', 'cash', 'bank', 'auto', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    /** YYYY-MM-DD in IST. There is deliberately no time component. */
    day: text('day').notNull(),
    kind: text('kind', { enum: TRANSACTION_KINDS }).notNull(),
    amount: integer('amount').notNull(),

    accountId: text('account_id').references(() => accounts.id, { onDelete: 'restrict' }),
    /** Destination account, transfers only. */
    counterAccountId: text('counter_account_id').references(() => accounts.id, { onDelete: 'restrict' }),

    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    personId: text('person_id').references(() => people.id, { onDelete: 'set null' }),
    debtId: text('debt_id').references(() => debts.id, { onDelete: 'cascade' }),
    loanId: text('loan_id').references(() => loans.id, { onDelete: 'cascade' }),
    installmentId: text('installment_id').references(() => installments.id, { onDelete: 'set null' }),

    /**
     * The slice of `amount` that is interest rather than principal. Lets a
     * single repayment row answer both "how much did I get back" and "how much
     * did that debt actually earn or cost me".
     */
    interestPart: integer('interest_part').notNull().default(0),

    method: text('method', { enum: PAYMENT_METHODS }).notNull().default('upi'),
    note: text('note'),
    /** The raw text typed into quick capture, kept so parsing can be audited. */
    rawInput: text('raw_input'),

    createdAt: integer('created_at').notNull().$defaultFn(now),
    updatedAt: integer('updated_at').notNull().$defaultFn(now),
  },
  (t) => [
    index('transactions_day_idx').on(t.day),
    index('transactions_kind_idx').on(t.kind),
    index('transactions_account_idx').on(t.accountId),
    index('transactions_category_idx').on(t.categoryId),
    index('transactions_person_idx').on(t.personId),
    index('transactions_debt_idx').on(t.debtId),
    index('transactions_loan_idx').on(t.loanId),
    check('transactions_amount_positive', sql`${t.amount} > 0`),
    check('transactions_interest_within_amount', sql`${t.interestPart} >= 0 AND ${t.interestPart} <= ${t.amount}`),
    check('transactions_day_shape', sql`${t.day} LIKE '____-__-__'`),
  ],
);

// --------------------------------------------------------------- recurring

export const RECURRING_CADENCES = ['monthly', 'weekly'] as const;
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];

/**
 * Known, repeating money: the stipend arriving, the 15,000 going to parents.
 * These are never posted automatically. They surface as something to confirm,
 * because a ledger that invents transactions is a ledger that lies.
 */
export const recurring = sqliteTable(
  'recurring',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind', { enum: TRANSACTION_KINDS }).notNull(),
    amount: integer('amount').notNull(),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    counterAccountId: text('counter_account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    cadence: text('cadence', { enum: RECURRING_CADENCES }).notNull().default('monthly'),
    /** 1-31 for monthly, clamped to the end of short months. 0-6 for weekly. */
    anchor: integer('anchor').notNull().default(1),
    nextDueOn: text('next_due_on').notNull(),
    lastPostedOn: text('last_posted_on'),
    method: text('method', { enum: PAYMENT_METHODS }).notNull().default('bank'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    note: text('note'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('recurring_next_due_idx').on(t.nextDueOn), index('recurring_active_idx').on(t.active)],
);

// --------------------------------------------------------- reconciliations

/**
 * The honesty mechanism. The user opens their banking app, types what it
 * actually says, and the difference becomes a real adjustment row with a
 * reason attached rather than a silent correction.
 */
export const reconciliations = sqliteTable(
  'reconciliations',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    expectedBalance: integer('expected_balance').notNull(),
    actualBalance: integer('actual_balance').notNull(),
    difference: integer('difference').notNull(),
    transactionId: text('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('reconciliations_account_idx').on(t.accountId), index('reconciliations_day_idx').on(t.day)],
);

// ---------------------------------------------------------------- settings

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull().$defaultFn(now),
});

// ------------------------------------------------------------------- types

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
export type Installment = typeof installments.$inferSelect;
export type NewInstallment = typeof installments.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Recurring = typeof recurring.$inferSelect;
export type NewRecurring = typeof recurring.$inferInsert;
export type Reconciliation = typeof reconciliations.$inferSelect;
export type Setting = typeof settings.$inferSelect;
