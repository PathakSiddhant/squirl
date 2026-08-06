import { asc, eq } from 'drizzle-orm';

import type { DayString } from '../date';
import { db } from '../db/client';
import { debts, people, type Debt, type Person } from '../db/schema';
export type { Person };
import { computeDebtPosition, type DebtEvent, type DebtPosition } from '../domain/interest';
import { sum } from '../money';
import { getAllDebtMovements } from './ledger';

export interface DebtWithPosition {
  debt: Debt;
  person: Person;
  position: DebtPosition;
  events: DebtEvent[];
}

/**
 * Every debt, replayed to `asOf`.
 *
 * All movements are fetched once and grouped in memory rather than issuing a
 * query per debt. With a few hundred rows this is far cheaper, and it keeps the
 * interest engine a pure function over data it was handed.
 */
export async function getDebtsWithPositions(asOf: DayString): Promise<DebtWithPosition[]> {
  const [rows, movements] = await Promise.all([
    db
      .select({ debt: debts, person: people })
      .from(debts)
      .innerJoin(people, eq(debts.personId, people.id))
      .orderBy(asc(debts.openedOn)),
    getAllDebtMovements(),
  ]);

  const byDebt = new Map<string, DebtEvent[]>();
  for (const movement of movements) {
    if (!movement.debtId) continue;
    const list = byDebt.get(movement.debtId) ?? [];

    if (movement.kind === 'lend' || movement.kind === 'borrow') {
      list.push({ type: 'principal', day: movement.day, amount: movement.amount });
    } else if (movement.kind === 'collect' || movement.kind === 'settle') {
      list.push({
        type: 'repayment',
        day: movement.day,
        amount: movement.amount,
        interestPart: movement.interestPart,
      });
    }

    byDebt.set(movement.debtId, list);
  }

  return rows.map(({ debt, person }) => {
    const events = byDebt.get(debt.id) ?? [];
    return {
      debt,
      person,
      events,
      position: computeDebtPosition(
        {
          openedOn: debt.openedOn,
          interestKind: debt.interestKind,
          rateBpsPerMonth: debt.rateBpsPerMonth,
        },
        events,
        asOf,
      ),
    };
  });
}

export interface PersonStanding {
  person: Person;
  /** Positive when they owe you, negative when you owe them. */
  net: number;
  owedToYou: number;
  youOwe: number;
  openDebts: DebtWithPosition[];
  /** Settled, written off, or fully repaid. Kept visible so it can be undone. */
  closedDebts: DebtWithPosition[];
  nextDueOn: DayString | null;
  hasOverdue: boolean;
}

/**
 * Rolls debts up per person, which is how the user actually thinks about it.
 *
 * Everyone in `allPeople` gets a row, even with nothing outstanding. Building
 * the list from debts alone hid anyone whose agreements were all settled or
 * written off, which left no way to reopen or delete them, and hid people
 * created by quick capture who never got an agreement at all.
 */
export function standingsByPerson(
  entries: DebtWithPosition[],
  asOf: DayString,
  allPeople: Person[] = [],
): PersonStanding[] {
  const byPerson = new Map<string, PersonStanding>();

  const blank = (person: Person): PersonStanding => ({
    person,
    net: 0,
    owedToYou: 0,
    youOwe: 0,
    openDebts: [],
    closedDebts: [],
    nextDueOn: null,
    hasOverdue: false,
  });

  for (const person of allPeople) byPerson.set(person.id, blank(person));

  for (const entry of entries) {
    const existing = byPerson.get(entry.person.id) ?? blank(entry.person);

    const isOpen = entry.debt.status === 'open' && !entry.position.isCleared;
    if (isOpen) {
      const value = entry.position.payoffTotal;
      if (entry.debt.direction === 'lent') existing.owedToYou += value;
      else existing.youOwe += value;

      existing.openDebts.push(entry);

      if (entry.debt.dueOn) {
        if (!existing.nextDueOn || entry.debt.dueOn < existing.nextDueOn) {
          existing.nextDueOn = entry.debt.dueOn;
        }
        if (entry.debt.dueOn < asOf) existing.hasOverdue = true;
      }
    } else {
      existing.closedDebts.push(entry);
    }

    existing.net = existing.owedToYou - existing.youOwe;
    byPerson.set(entry.person.id, existing);
  }

  // Anyone you actually owe or are owed floats to the top; the rest follow by name.
  return [...byPerson.values()].sort((a, b) => {
    const weight = Math.abs(b.net) - Math.abs(a.net);
    if (weight !== 0) return weight;
    const activity = b.openDebts.length - a.openDebts.length;
    if (activity !== 0) return activity;
    return a.person.name.localeCompare(b.person.name);
  });
}

export interface DebtTotals {
  owedToMe: number;
  owedByMe: number;
  /** Interest earned and paid so far, so the cost of borrowing is visible. */
  interestEarned: number;
  interestPaid: number;
}

export function debtTotals(entries: DebtWithPosition[]): DebtTotals {
  const open = entries.filter((e) => e.debt.status === 'open');
  return {
    owedToMe: sum(open.filter((e) => e.debt.direction === 'lent').map((e) => e.position.payoffTotal)),
    owedByMe: sum(open.filter((e) => e.debt.direction === 'borrowed').map((e) => e.position.payoffTotal)),
    interestEarned: sum(
      entries.filter((e) => e.debt.direction === 'lent').map((e) => e.position.interestPaid),
    ),
    interestPaid: sum(
      entries.filter((e) => e.debt.direction === 'borrowed').map((e) => e.position.interestPaid),
    ),
  };
}

export async function getDebt(id: string) {
  const [row] = await db
    .select({ debt: debts, person: people })
    .from(debts)
    .innerJoin(people, eq(debts.personId, people.id))
    .where(eq(debts.id, id))
    .limit(1);
  return row ?? null;
}
