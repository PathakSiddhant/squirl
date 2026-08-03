import { addDays, isDayString, today as istToday, type DayString } from '../date';
import { parseAmount, type Paise } from '../money';
import type { PaymentMethod, TransactionKind } from '../db/schema';

/**
 * Turns a line of typed text into a transaction.
 *
 * The capture failure is the whole reason the brief exists: a 10 rupee chai
 * paid by UPI never gets logged, because opening a form with six fields costs
 * more than the chai did. So `chai 20` has to be a complete, valid, correctly
 * categorised transaction, and everything else is a refinement on top.
 *
 * Deterministic on purpose. No model call, no network, no latency, and the
 * same input always produces the same row. Every inference is reported in
 * `matches` so the UI can show what it decided and let the user overrule it.
 */

export interface CaptureContext {
  today: DayString;
  people: Array<{ id: string; name: string; handle: string | null }>;
  categories: Array<{ id: string; name: string; flow: 'in' | 'out'; keywords: string }>;
  accounts: Array<{ id: string; name: string; kind: string }>;
}

export type CaptureField = 'amount' | 'day' | 'kind' | 'person' | 'category' | 'method' | 'account';

export interface CaptureMatch {
  field: CaptureField;
  /** The exact text that produced the inference, for highlighting. */
  text: string;
}

export interface ParsedCapture {
  ok: boolean;
  amount: Paise | null;
  kind: TransactionKind;
  day: DayString;
  method: PaymentMethod;
  categoryId: string | null;
  personId: string | null;
  /** Set when a name was used that does not match anyone yet. */
  newPersonName: string | null;
  accountId: string | null;
  counterAccountId: string | null;
  note: string;
  matches: CaptureMatch[];
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4, friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

/**
 * Hinglish is first-class here, because that is how the user actually types.
 *
 * `verbs` are consumed once matched. `nouns` set the direction but stay in the
 * string, because they are usually also the category: in "got 20000 stipend"
 * the word stipend has to survive long enough to pick the Stipend category.
 */
const KIND_HINTS: Array<{ kind: TransactionKind; verbs: RegExp[]; nouns?: RegExp[] }> = [
  {
    kind: 'collect',
    verbs: [/\bpaid me back\b/, /\bpaid back\b/, /\bgave back\b/, /\bgot back\b/, /\breturned\b/, /\brepaid\b/, /\bwapas\b/, /\bcollected\b/],
  },
  { kind: 'settle', verbs: [/\bsettled\b/, /\bpay(ed|ing)? back\b/, /\bchukaya\b/, /\bsettle\b/] },
  { kind: 'lend', verbs: [/\blent\b/, /\blend\b/, /\bloaned\b/, /\budhaar diya\b/, /\bdiya\b/] },
  { kind: 'borrow', verbs: [/\bborrowed\b/, /\bborrow\b/, /\budhaar liya\b/, /\bliya\b/] },
  { kind: 'transfer', verbs: [/\bmoved\b/, /\btransferred\b/, /\btransfer\b/, /\bbheja\b/] },
  {
    kind: 'income',
    verbs: [/\bgot\b/, /\breceived\b/, /\bearned\b/, /\bmila\b/],
    nouns: [/\bstipend\b/, /\bsalary\b/, /\bincome\b/, /\brefund\b/, /\bcashback\b/, /\bfreelance\b/],
  },
];

const METHOD_HINTS: Array<{ method: PaymentMethod; patterns: RegExp[] }> = [
  { method: 'upi', patterns: [/\bupi\b/, /\bgpay\b/, /\bg pay\b/, /\bphonepe\b/, /\bpaytm\b/, /\bbhim\b/, /\bscan(ned)?\b/] },
  { method: 'card', patterns: [/\bcard\b/, /\bdebit\b/, /\bcredit\b/, /\bswipe(d)?\b/] },
  { method: 'cash', patterns: [/\bcash\b/, /\bnakad\b/] },
  { method: 'bank', patterns: [/\bneft\b/, /\bimps\b/, /\brtgs\b/, /\bnetbanking\b/, /\bbank transfer\b/] },
  { method: 'auto', patterns: [/\bautopay\b/, /\bauto ?debit\b/, /\bmandate\b/] },
];

const KINDS_NEEDING_PERSON: TransactionKind[] = ['lend', 'borrow', 'collect', 'settle'];

export function parseCapture(input: string, context: CaptureContext): ParsedCapture {
  const matches: CaptureMatch[] = [];
  const original = input.trim();
  let working = ` ${original.toLowerCase()} `;

  const consume = (text: string, field: CaptureField) => {
    if (!text) return;
    matches.push({ field, text: text.trim() });
    working = working.replace(text, ' ');
  };

  // 1. Date first, so "2 aug" cannot be mistaken for an amount of 2.
  const day = extractDay(working, context.today, consume);

  // 2. Direction. An explicit leading + or - beats every keyword.
  let kind: TransactionKind = 'expense';
  const signMatch = working.match(/(^|\s)([+-])\s*(?=\d|₹)/);
  if (signMatch) {
    kind = signMatch[2] === '+' ? 'income' : 'expense';
    matches.push({ field: 'kind', text: signMatch[2] });
    working = working.replace(signMatch[0], ' ');
  } else {
    let decided = false;
    for (const hint of KIND_HINTS) {
      const verb = hint.verbs.find((p) => p.test(working));
      if (verb) {
        kind = hint.kind;
        consume(working.match(verb)?.[0] ?? '', 'kind');
        decided = true;
        break;
      }
    }
    if (!decided) {
      for (const hint of KIND_HINTS) {
        const noun = hint.nouns?.find((p) => p.test(working));
        if (noun) {
          kind = hint.kind;
          // Noted, not consumed: the same word usually names the category too.
          matches.push({ field: 'kind', text: working.match(noun)?.[0]?.trim() ?? '' });
          break;
        }
      }
    }
  }

  // 3. Amount.
  const amount = extractAmount(working, consume);

  // 4. Method.
  let method: PaymentMethod = kind === 'expense' ? 'upi' : 'bank';
  for (const hint of METHOD_HINTS) {
    const found = hint.patterns.find((p) => p.test(working));
    if (found) {
      method = hint.method;
      consume(working.match(found)?.[0] ?? '', 'method');
      break;
    }
  }

  // 5. Person, but only where a person is meaningful.
  let personId: string | null = null;
  let newPersonName: string | null = null;
  if (KINDS_NEEDING_PERSON.includes(kind)) {
    const person = extractPerson(working, context.people, consume);
    personId = person.id;
    newPersonName = person.newName;
  }

  // 6. Account. A named account wins over the default.
  const { accountId, counterAccountId } = extractAccounts(working, context.accounts, kind, consume);

  // 7. Category, from the words that are left.
  const categoryId = kind === 'expense' || kind === 'income'
    ? extractCategory(working, context.categories, kind === 'income' ? 'in' : 'out', consume)
    : null;

  const note = tidyNote(working);

  return {
    ok: amount !== null && amount > 0,
    amount,
    kind,
    day,
    method,
    categoryId,
    personId,
    newPersonName,
    accountId,
    counterAccountId,
    note,
    matches,
  };
}

// ------------------------------------------------------------------ parts

function extractDay(
  working: string,
  today: DayString,
  consume: (text: string, field: CaptureField) => void,
): DayString {
  const relative: Array<[RegExp, number]> = [
    [/\btoday\b|\baaj\b|\btdy\b/, 0],
    [/\byesterday\b|\bkal\b|\byday\b|\byest\b/, -1],
    [/\bday before yesterday\b|\bparso\b/, -2],
  ];
  for (const [pattern, delta] of relative) {
    const found = working.match(pattern);
    if (found) {
      consume(found[0], 'day');
      return addDays(today, delta);
    }
  }

  const nDaysAgo = working.match(/\b(\d{1,3})\s*(?:days?|d)\s*(?:ago|back|pehle)\b/);
  if (nDaysAgo) {
    consume(nDaysAgo[0], 'day');
    return addDays(today, -Number(nDaysAgo[1]));
  }

  const lastWeekday = working.match(/\b(?:last\s+)?(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thu|friday|fri|saturday|sat)\b/);
  if (lastWeekday) {
    const target = WEEKDAYS[lastWeekday[1]];
    const current = new Date(`${today}T00:00:00Z`).getUTCDay();
    // Always look backwards. A logged transaction has already happened.
    const back = (current - target + 7) % 7 || 7;
    consume(lastWeekday[0], 'day');
    return addDays(today, -back);
  }

  const iso = working.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso && isDayString(iso[1])) {
    consume(iso[0], 'day');
    return iso[1];
  }

  // "2 aug", "aug 2", "2nd august"
  const dayMonth = working.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\b/);
  if (dayMonth && MONTHS[dayMonth[2]]) {
    const resolved = resolveDayMonth(Number(dayMonth[1]), MONTHS[dayMonth[2]], today);
    if (resolved) {
      consume(dayMonth[0], 'day');
      return resolved;
    }
  }
  const monthDay = working.match(/\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (monthDay && MONTHS[monthDay[1]]) {
    const resolved = resolveDayMonth(Number(monthDay[2]), MONTHS[monthDay[1]], today);
    if (resolved) {
      consume(monthDay[0], 'day');
      return resolved;
    }
  }

  // "12/7" or "12/7/26", read day-first the way it is written in India.
  const numeric = working.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numeric) {
    const d = Number(numeric[1]);
    const m = Number(numeric[2]);
    let year = numeric[3] ? Number(numeric[3]) : Number(today.slice(0, 4));
    if (year < 100) year += 2000;
    const candidate = `${year}-${`${m}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`;
    if (isDayString(candidate) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      consume(numeric[0], 'day');
      return candidate;
    }
  }

  return today;
}

/**
 * A bare day and month has no year. Assume the most recent occurrence, since
 * people log what already happened far more often than what will happen.
 */
function resolveDayMonth(d: number, m: number, today: DayString): DayString | null {
  if (d < 1 || d > 31 || m < 1 || m > 12) return null;
  const year = Number(today.slice(0, 4));
  const sameYear = `${year}-${`${m}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`;
  if (!isDayString(sameYear)) return null;
  if (sameYear <= today) return sameYear;
  const lastYear = `${year - 1}-${`${m}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`;
  return isDayString(lastYear) ? lastYear : sameYear;
}

function extractAmount(
  working: string,
  consume: (text: string, field: CaptureField) => void,
): Paise | null {
  const candidates = working.matchAll(/(?:^|\s)₹?\s*(\d+(?:\.\d+)?)\s*([kKlL])?(?=\s|$)/g);
  for (const candidate of candidates) {
    const raw = `${candidate[1]}${candidate[2] ?? ''}`;
    const parsed = parseAmount(raw);
    if (parsed !== null && parsed > 0) {
      consume(candidate[0], 'amount');
      return parsed;
    }
  }
  return null;
}

function extractPerson(
  working: string,
  people: CaptureContext['people'],
  consume: (text: string, field: CaptureField) => void,
): { id: string | null; newName: string | null } {
  // A known name or handle anywhere in the line wins.
  for (const person of people) {
    const names = [person.handle, person.name.split(/\s+/)[0], person.name].filter(Boolean) as string[];
    for (const name of names) {
      const pattern = new RegExp(`\\b${escapeRegExp(name.toLowerCase())}\\b`);
      const found = working.match(pattern);
      if (found) {
        consume(found[0], 'person');
        return { id: person.id, newName: null };
      }
    }
  }

  // Otherwise take the word after to / from as a new person.
  const preposition = working.match(/\b(?:to|from|se|ko)\s+([a-z][a-z'-]{1,20})\b/);
  if (preposition) {
    consume(preposition[0], 'person');
    return { id: null, newName: titleCase(preposition[1]) };
  }

  return { id: null, newName: null };
}

function extractAccounts(
  working: string,
  accounts: CaptureContext['accounts'],
  kind: TransactionKind,
  consume: (text: string, field: CaptureField) => void,
): { accountId: string | null; counterAccountId: string | null } {
  const hits: string[] = [];
  for (const account of accounts) {
    const pattern = new RegExp(`\\b${escapeRegExp(account.name.toLowerCase())}\\b`);
    if (pattern.test(working)) {
      hits.push(account.id);
      consume(working.match(pattern)?.[0] ?? '', 'account');
    }
  }

  if (kind === 'transfer' && hits.length >= 2) {
    return { accountId: hits[0], counterAccountId: hits[1] };
  }
  if (kind === 'transfer' && hits.length === 1) {
    // "moved 15000 to parents" names only the destination.
    const parked = accounts.find((a) => a.id === hits[0])?.kind === 'parked';
    return parked
      ? { accountId: null, counterAccountId: hits[0] }
      : { accountId: hits[0], counterAccountId: null };
  }
  return { accountId: hits[0] ?? null, counterAccountId: null };
}

function extractCategory(
  working: string,
  categories: CaptureContext['categories'],
  flow: 'in' | 'out',
  consume: (text: string, field: CaptureField) => void,
): string | null {
  let best: { id: string; text: string; length: number } | null = null;

  for (const category of categories) {
    if (category.flow !== flow) continue;
    const terms = [category.name, ...category.keywords.split(',')]
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    for (const term of terms) {
      const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`);
      const found = working.match(pattern);
      // Longest match wins, so "food delivery" beats a bare "food".
      if (found && (!best || term.length > best.length)) {
        best = { id: category.id, text: found[0], length: term.length };
      }
    }
  }

  if (!best) return null;
  consume(best.text, 'category');
  return best.id;
}

function tidyNote(working: string): string {
  return working
    .replace(/\b(?:to|from|for|on|at|se|ko|ka|ke|me|in)\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s'&.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Examples shown under an empty capture bar, so the syntax teaches itself. */
export const CAPTURE_EXAMPLES = [
  'chai 20',
  '250 zomato upi',
  '+5000 freelance',
  'lent 1000 to rahul',
  'borrowed 500 from amit',
  'rahul paid back 1000',
  'moved 15000 to parents',
  '899 netflix card 2 aug',
] as const;

export function emptyCapture(today: DayString = istToday()): ParsedCapture {
  return {
    ok: false,
    amount: null,
    kind: 'expense',
    day: today,
    method: 'upi',
    categoryId: null,
    personId: null,
    newPersonName: null,
    accountId: null,
    counterAccountId: null,
    note: '',
    matches: [],
  };
}
