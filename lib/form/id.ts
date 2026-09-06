import { makeId } from '@/lib/db/id';

/**
 * Form's own row prefixes, so a raw SQL session is readable at a glance and no
 * id can be mistaken for one of Ledger's or Signal's.
 */
export type FormIdPrefix =
  | 'fph' // phase
  | 'fpm' // phase metric
  | 'fth' // target history
  | 'fen' // day entry
  | 'fwt' // weight reading
  | 'ffd' // food
  | 'ffl' // food log
  | 'fms' // measurement
  | 'fpt' // photo
  | 'fnt'; // note

export function newFormId(prefix: FormIdPrefix): string {
  return makeId(prefix);
}
