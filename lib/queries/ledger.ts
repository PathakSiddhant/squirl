import { and, asc, desc, eq, gte, isNotNull, like, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { db } from '../db/client';
import { accounts, categories, installments, loans, people, transactions } from '../db/schema';
import type { DayString } from '../date';
import type { LedgerMovement } from '../domain/position';

/**
 * Reads over the transaction ledger.
 *
 * Movements are kept deliberately narrow: the position engine only needs day,
 * kind, amount and the two account ids, and pulling whole rows for a four
 * month history just to add them up would be wasteful.
 */

export async function getMovements(from?: DayString, to?: DayString): Promise<LedgerMovement[]> {
  const filters: SQL[] = [];
  if (from) filters.push(gte(transactions.day, from));
  if (to) filters.push(lte(transactions.day, to));

  return db
    .select({
      day: transactions.day,
      kind: transactions.kind,
      amount: transactions.amount,
      accountId: transactions.accountId,
      counterAccountId: transactions.counterAccountId,
    })
    .from(transactions)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(transactions.day));
}

/** A ledger row with every label already resolved, ready to render. */
export interface LedgerEntry {
  id: string;
  day: DayString;
  kind: (typeof transactions.$inferSelect)['kind'];
  amount: number;
  interestPart: number;
  method: (typeof transactions.$inferSelect)['method'];
  note: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  accountName: string | null;
  counterAccountName: string | null;
  personName: string | null;
  /** Raw ids too, so a row can be opened in the editor without a second query. */
  accountId: string | null;
  counterAccountId: string | null;
  categoryId: string | null;
  personId: string | null;
  debtId: string | null;
  loanId: string | null;
  installmentId: string | null;
  lenderName: string | null;
  installmentSeq: number | null;
}

/** The destination side of a transfer, joined from the same accounts table. */
const counterAccounts = alias(accounts, 'counter_account');

export interface LedgerFilters {
  from?: DayString;
  to?: DayString;
  search?: string;
  kinds?: Array<LedgerEntry['kind']>;
  categoryId?: string;
  accountId?: string;
  personId?: string;
  limit?: number;
  offset?: number;
}

export async function getLedgerEntries(filters: LedgerFilters = {}): Promise<LedgerEntry[]> {
  const conditions: SQL[] = [];
  if (filters.from) conditions.push(gte(transactions.day, filters.from));
  if (filters.to) conditions.push(lte(transactions.day, filters.to));
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.personId) conditions.push(eq(transactions.personId, filters.personId));
  if (filters.accountId) {
    conditions.push(
      or(
        eq(transactions.accountId, filters.accountId),
        eq(transactions.counterAccountId, filters.accountId),
      )!,
    );
  }
  if (filters.kinds?.length) {
    conditions.push(
      or(...filters.kinds.map((k) => eq(transactions.kind, k)))!,
    );
  }
  if (filters.search) {
    const needle = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${transactions.note})`, needle),
        like(sql`lower(${categories.name})`, needle),
        like(sql`lower(${people.name})`, needle),
        like(sql`lower(${transactions.rawInput})`, needle),
      )!,
    );
  }

  const rows = await db
    .select({
      id: transactions.id,
      day: transactions.day,
      kind: transactions.kind,
      amount: transactions.amount,
      interestPart: transactions.interestPart,
      method: transactions.method,
      note: transactions.note,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      accountName: accounts.name,
      counterAccountName: counterAccounts.name,
      personName: people.name,
      accountId: transactions.accountId,
      counterAccountId: transactions.counterAccountId,
      categoryId: transactions.categoryId,
      personId: transactions.personId,
      debtId: transactions.debtId,
      loanId: transactions.loanId,
      installmentId: transactions.installmentId,
      lenderName: loans.lender,
      installmentSeq: installments.seq,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(counterAccounts, eq(transactions.counterAccountId, counterAccounts.id))
    .leftJoin(people, eq(transactions.personId, people.id))
    .leftJoin(loans, eq(transactions.loanId, loans.id))
    .leftJoin(installments, eq(transactions.installmentId, installments.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(transactions.day), desc(transactions.createdAt))
    .limit(filters.limit ?? 200)
    .offset(filters.offset ?? 0);

  return rows as LedgerEntry[];
}

export async function countLedgerEntries(filters: LedgerFilters = {}): Promise<number> {
  const conditions: SQL[] = [];
  if (filters.from) conditions.push(gte(transactions.day, filters.from));
  if (filters.to) conditions.push(lte(transactions.day, filters.to));

  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(transactions)
    .where(conditions.length ? and(...conditions) : undefined);

  return row?.n ?? 0;
}

/** Every day that has at least one entry, for the streak and the calendar. */
export async function getLoggedDays(from?: DayString): Promise<Set<DayString>> {
  const rows = await db
    .selectDistinct({ day: transactions.day })
    .from(transactions)
    .where(from ? gte(transactions.day, from) : undefined);
  return new Set(rows.map((r) => r.day));
}

export async function getTransaction(id: string) {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return row ?? null;
}

/** Spend by category over a window, largest first. */
export async function getCategoryTotals(from: DayString, to: DayString) {
  return db
    .select({
      categoryId: categories.id,
      name: categories.name,
      icon: categories.icon,
      flow: categories.flow,
      total: sql<number>`sum(${transactions.amount})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        gte(transactions.day, from),
        lte(transactions.day, to),
        or(eq(transactions.kind, 'expense'), eq(transactions.kind, 'income')),
      ),
    )
    .groupBy(categories.id)
    .orderBy(desc(sql`sum(${transactions.amount})`));
}

/** Spend split by how it was paid, which is where untracked money hides. */
export async function getMethodTotals(from: DayString, to: DayString) {
  return db
    .select({
      method: transactions.method,
      total: sql<number>`sum(${transactions.amount})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(and(gte(transactions.day, from), lte(transactions.day, to), eq(transactions.kind, 'expense')))
    .groupBy(transactions.method)
    .orderBy(desc(sql`sum(${transactions.amount})`));
}

export async function getBiggestExpenses(from: DayString, to: DayString, limit = 5) {
  return db
    .select({
      id: transactions.id,
      day: transactions.day,
      amount: transactions.amount,
      note: transactions.note,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(gte(transactions.day, from), lte(transactions.day, to), eq(transactions.kind, 'expense')))
    .orderBy(desc(transactions.amount))
    .limit(limit);
}

/** Transactions attached to a debt, in the shape the interest engine wants. */
export async function getDebtMovements(debtId: string) {
  return db
    .select({
      day: transactions.day,
      kind: transactions.kind,
      amount: transactions.amount,
      interestPart: transactions.interestPart,
    })
    .from(transactions)
    .where(eq(transactions.debtId, debtId))
    .orderBy(asc(transactions.day));
}

export async function getAllDebtMovements() {
  return db
    .select({
      debtId: transactions.debtId,
      day: transactions.day,
      kind: transactions.kind,
      amount: transactions.amount,
      interestPart: transactions.interestPart,
    })
    .from(transactions)
    .where(isNotNull(transactions.debtId))
    .orderBy(asc(transactions.day));
}
