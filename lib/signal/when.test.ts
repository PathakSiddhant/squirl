import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sinceLabel } from './when';

/** A moment given in IST, so the fixtures read the way the reader would say them. */
const ist = (y: number, month: number, d: number, h: number, m: number) =>
  Date.UTC(y, month - 1, d, h, m) - 5.5 * 3_600_000;

describe('sinceLabel', () => {
  const now = ist(2026, 11, 22, 12, 6); // Sunday 22 November, 12:06 pm IST

  it('is just the time for something earlier today', () => {
    assert.match(sinceLabel(ist(2026, 11, 22, 9, 30), now), /^9:30\s?am$/i);
  });

  it('says yesterday for the day before, even ten minutes before midnight', () => {
    assert.match(sinceLabel(ist(2026, 11, 21, 23, 50), now), /^yesterday, 11:50\s?pm$/i);
  });

  it('names the weekday within the week', () => {
    assert.match(sinceLabel(ist(2026, 11, 19, 14, 30), now), /^Thu, 2:30\s?pm$/i);
  });

  it('gives the date once a bare weekday would be ambiguous', () => {
    assert.match(sinceLabel(ist(2026, 11, 12, 14, 30), now), /^12 Nov, 2:30\s?pm$/i);
  });

  it('counts calendar days in IST, not blocks of twenty-four hours', () => {
    // 1:00 am today is eleven hours ago, yet 11:30 pm last night is one
    // calendar day back even though only 13 hours separate it from `now`.
    const afterMidnight = ist(2026, 11, 22, 1, 0);
    assert.match(sinceLabel(afterMidnight, now), /^1:00\s?am$/i);
    assert.match(sinceLabel(ist(2026, 11, 21, 23, 30), now), /^yesterday,/i);
  });

  it('reads the instant in IST whatever the machine’s own timezone', () => {
    // 04:00 UTC is 9:30 am IST. A formatter left on the machine's zone would
    // say 4:00 am anywhere in UTC.
    assert.match(sinceLabel(Date.UTC(2026, 10, 22, 4, 0), now), /^9:30\s?am$/i);
  });
});
