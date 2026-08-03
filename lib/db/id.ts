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
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
