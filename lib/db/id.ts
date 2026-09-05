import { randomUUID } from 'node:crypto';

/**
 * Prefixed ids, so a row is self-describing when you are staring at raw SQL at
 * 1am wondering why a balance is off.
 */
export type IdPrefix =
  | 'acc'
  | 'cat'
  | 'per'
  | 'debt'
  | 'loan'
  | 'inst'
  | 'txn'
  | 'rec'
  | 'rcn';

export function newId(prefix: IdPrefix): string {
  return makeId(prefix);
}

/**
 * The same generator, without Ledger's list of prefixes.
 *
 * An application names its own rows. Adding every application's prefixes to
 * the union above would make this shared utility grow a vocabulary for each
 * one, which is precisely the coupling the registry exists to avoid.
 */
export function makeId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
