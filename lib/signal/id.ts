import { makeId } from '@/lib/db/id';

/**
 * Signal's own row prefixes, so raw SQL is readable at a glance and no id can
 * be mistaken for one of Ledger's.
 */
export type SignalIdPrefix = 'sch' | 'vid' | 'scat' | 'stop';

export function newSignalId(prefix: SignalIdPrefix): string {
  return makeId(prefix);
}
