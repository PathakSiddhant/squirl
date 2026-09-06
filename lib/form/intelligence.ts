import { z } from 'zod';

import { keyCount, nextKey, releaseKey, restKey } from '@/lib/squirl/keys';

import { explain, VERDICT_LABEL, type Check } from './feasibility';

/**
 * The model's job in Form, which is deliberately small.
 *
 * ## What it is never asked
 *
 * It is never asked whether a goal is safe, how fast a person can lose weight,
 * what anybody's calorie target should be, or anything else with a right
 * answer. Those are computed in `feasibility.ts` and `calc.ts`, from published
 * rate guidance, in code that has tests. A model asked to make that judgement
 * from scratch would be approximately right most of the time and confidently
 * wrong occasionally, with no way to tell the two apart from outside — which
 * is an unacceptable trade for a question that touches somebody's health.
 *
 * ## What it is asked
 *
 * To say a verdict that has already been reached in one or two sentences of
 * plain English. It receives the numbers and the conclusion and rewrites them;
 * it does not get to disagree. Anything it returns that looks like it is
 * arguing with the arithmetic is discarded in favour of the deterministic
 * sentence.
 *
 * ## And it is entirely optional
 *
 * With no key, no network, or every key exhausted, `phraseVerdict` returns null
 * and the caller uses `explain()` — the same sentence, slightly stiffer.
 * Nothing in Form stops working because a model was unreachable (§105).
 */

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const answer = z.object({ sentence: z.string().min(10).max(600) });

export function intelligenceAvailable(): boolean {
  return keyCount('gemini') > 0;
}

function prompt(result: Check, unit: string): string {
  const kg = (Math.abs(result.weeklyG) / 1000).toFixed(2);
  const pct = (result.rate * 100).toFixed(1);
  const months = (weeks: number) => Math.round((weeks / 52) * 12);

  return `Rewrite a verdict about a bodyweight goal in one or two short sentences.

The verdict has already been decided by validated code. Do not re-judge it, do
not soften it, do not make it stricter, and do not add any number that is not
listed below.

  verdict: ${VERDICT_LABEL[result.verdict]}
  direction: ${result.direction}
  rate: ${kg} ${unit} per week, which is ${pct}% of bodyweight per week
  timeline requested: ${result.weeks} weeks
  quickest sensible timeline: ${result.fastestSaneWeeks} weeks (about ${months(result.fastestSaneWeeks)} months)
  comfortable timeline: ${result.comfortableWeeks} weeks (about ${months(result.comfortableWeeks)} months)
  would require eating below a safe floor: ${result.belowEnergyFloor}

Rules for the sentence:
- Address the plan, never the person. Never say the reader is unrealistic, lazy,
  impatient or greedy.
- No encouragement, no motivational language, no exclamation marks, no emoji.
- No medical claims and no advice about health conditions.
- Plain, calm, specific. Two sentences at most.
- If the verdict is aggressive or out of reach, name a better timeline using the
  numbers above.

Reply with JSON only: {"sentence":"..."}`;
}

/**
 * Ask the model to phrase a verdict. Null whenever it cannot be reached.
 *
 * Every configured key is tried before giving up: these are free-tier keys
 * whose per-minute limits are hit routinely, and one busy key should not cost
 * the reader the nicer sentence.
 */
export async function phraseVerdict(result: Check, unit = 'kg'): Promise<string | null> {
  const attempts = Math.max(keyCount('gemini'), 1);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const key = nextKey('gemini');
    if (!key) return null;

    try {
      const response = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt(result, unit) }] }],
          generationConfig: {
            // A verdict that reworded itself every time the reader nudged the
            // timeline would read as indecision rather than as an explanation.
            temperature: 0,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (response.status === 429 || response.status === 403) {
        restKey('gemini', key, response.status === 429 ? Date.now() + 60_000 : undefined);
        continue;
      }
      if (!response.ok) continue;

      const body = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const parsed = answer.safeParse(JSON.parse(text));
      if (!parsed.success) continue;

      releaseKey('gemini', key);

      const sentence = parsed.data.sentence.trim();
      return acceptable(sentence) ? sentence : explain(result);
    } catch {
      // No network, a timeout, malformed JSON: try the next key, and if there
      // are none left the caller falls back to the deterministic sentence.
      continue;
    }
  }

  return null;
}

/**
 * A last check on what came back.
 *
 * Cheap, and worth it. The model is being asked to rephrase rather than to
 * reason, so anything that reads as encouragement, as a medical opinion, or as
 * an instruction to the reader has stepped outside the job and is thrown away
 * in favour of the sentence Form wrote itself.
 */
function acceptable(sentence: string): boolean {
  if (sentence.length < 15) return false;
  const banned =
    /\b(you (?:can do|got this|should consult|must see)|doctor|physician|medical|diagnos|crush|smash|amazing|great job|keep going|don'?t give up)\b/i;
  return !banned.test(sentence) && !/[!]{1,}/.test(sentence);
}
