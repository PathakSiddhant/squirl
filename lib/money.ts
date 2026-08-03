/**
 * Money is stored and computed as an integer number of paise, never as a float.
 *
 * 0.1 + 0.2 !== 0.3, and a ledger that drifts by a paisa per row is a ledger
 * nobody trusts. Every amount crossing the database boundary is an integer.
 */

export type Paise = number;

export const PAISE_PER_RUPEE = 100;

/** Rupees (possibly fractional) to whole paise. Rounds half away from zero. */
export function toPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees)) return 0;
  return Math.sign(rupees) * Math.round(Math.abs(rupees) * PAISE_PER_RUPEE);
}

/** Paise back to rupees as a float. Only for display or chart scales. */
export function toRupees(paise: Paise): number {
  return paise / PAISE_PER_RUPEE;
}

/**
 * Parses whatever a human types into paise.
 *
 * Accepts "1200", "1,200", "₹1200", "1200.50", "1.2k", "1.5K", "2L", "-350".
 * Returns null when there is no number in the string at all, so callers can
 * tell "user typed nothing" apart from "user typed zero".
 */
export function parseAmount(input: string): Paise | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/[₹,\s]/g, '');
  if (!cleaned) return null;

  const match = cleaned.match(/^(-)?(\d+(?:\.\d+)?)([kKlLcC])?$/);
  if (!match) return null;

  const [, sign, digits, suffix] = match;
  let value = Number(digits);
  if (!Number.isFinite(value)) return null;

  switch (suffix?.toLowerCase()) {
    case 'k':
      value *= 1_000;
      break;
    case 'l':
      value *= 100_000;
      break;
    case 'c':
      value *= 10_000_000;
      break;
  }

  return toPaise(sign ? -value : value);
}

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrExact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plainWhole = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export interface FormatMoneyOptions {
  /** Show paise. Defaults to showing them only when they are non-zero. */
  paise?: boolean;
  /** Drop the ₹ glyph, for use next to a symbol that is already on screen. */
  bare?: boolean;
  /** Always show a leading + or -. */
  signed?: boolean;
}

/**
 * Formats paise with Indian digit grouping: 1234567 paise -> "₹12,345.67".
 *
 * Fractional paise are hidden when they are zero, because a ledger of round
 * rupees should not be a wall of ".00".
 */
export function formatMoney(value: Paise, options: FormatMoneyOptions = {}): string {
  const { paise, bare = false, signed = false } = options;
  const showPaise = paise ?? value % PAISE_PER_RUPEE !== 0;
  const magnitude = Math.abs(value);
  const rupees = magnitude / PAISE_PER_RUPEE;

  let text: string;
  if (bare) {
    text = showPaise
      ? rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : plainWhole.format(rupees);
  } else {
    text = showPaise ? inrExact.format(rupees) : inrWhole.format(rupees);
  }

  if (value < 0) return `-${text}`;
  if (signed && value > 0) return `+${text}`;
  return text;
}

/**
 * Short form for tight spaces: 950 -> "950", 12_50_000 -> "12.5k", 250_00_000 -> "2.5L".
 * Takes paise, returns a bare string with no currency glyph.
 */
export function formatCompact(value: Paise): string {
  const rupees = Math.abs(value) / PAISE_PER_RUPEE;
  const sign = value < 0 ? '-' : '';

  if (rupees >= 10_000_000) return `${sign}${trim(rupees / 10_000_000)}Cr`;
  if (rupees >= 100_000) return `${sign}${trim(rupees / 100_000)}L`;
  if (rupees >= 1_000) return `${sign}${trim(rupees / 1_000)}k`;
  return `${sign}${plainWhole.format(rupees)}`;
}

function trim(n: number): string {
  return n
    .toFixed(1)
    .replace(/\.0$/, '')
    .replace(/(\.\d)0$/, '$1');
}

/**
 * Splits a total into `parts` integer pieces that sum back to exactly the total.
 * The remainder lands on the earliest pieces, so an EMI schedule never loses or
 * invents a paisa in the final installment.
 */
export function distribute(total: Paise, parts: number): Paise[] {
  if (parts <= 0) return [];
  const sign = total < 0 ? -1 : 1;
  const magnitude = Math.abs(total);
  const base = Math.floor(magnitude / parts);
  const remainder = magnitude - base * parts;

  return Array.from({ length: parts }, (_, i) => sign * (base + (i < remainder ? 1 : 0)));
}

/** Sums paise safely, ignoring nullish entries. */
export function sum(values: Array<Paise | null | undefined>): Paise {
  let total = 0;
  for (const v of values) if (typeof v === 'number' && Number.isFinite(v)) total += v;
  return total;
}

/** Clamps to zero. Used wherever a negative would be nonsense, like "safe to spend". */
export function atLeastZero(value: Paise): Paise {
  return value > 0 ? value : 0;
}
