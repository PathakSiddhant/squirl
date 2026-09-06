import { z } from 'zod';

import { DEFAULT_CATEGORIES } from './categories';
import { keyCount, nextKey, releaseKey, restKey } from '@/lib/squirl/keys';
import type { YouTubeChannel } from './youtube';

/**
 * Classifying channels with a model, when one is available.
 *
 * ## Why this is allowed to exist in a local-first product
 *
 * Signal's promise is that *your* data never leaves the machine: what you
 * follow, what you have watched, what you dismissed, when you look. None of
 * that is sent here. What is sent is a channel's public title and public
 * description, which are already public, already came from Google minutes
 * earlier, and say nothing about the reader.
 *
 * It is also strictly optional. With no key configured, or the network down,
 * or every key exhausted, `classifyWithAI` returns null and the caller falls
 * back to the local keyword heuristic. Signal never stops working because a
 * model was unavailable, and nothing in the queue depends on one.
 *
 * ## Why it is worth it
 *
 * The keyword heuristic filed CarryMinati, BB Ki Vines and Angry Prash under
 * Business, because every one of their descriptions ends with a line about
 * business enquiries. Stripping that boilerplate helps, but the underlying
 * problem does not go away: a table of words cannot tell that "Aakash Gupta"
 * is a stand-up comedian and "Ravi Gupta" is a different stand-up comedian
 * while "AB Cricinfo" is cricket, when none of those descriptions contain the
 * word comedy or cricket. A model can, and this is exactly the sort of small,
 * bounded, verifiable judgement worth spending one on.
 */

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const SLUGS: string[] = DEFAULT_CATEGORIES.map((category) => category.slug);

export interface Classification {
  youtubeId: string;
  category: string;
  /** Two or three narrow subjects, lowercase. Free text, not from a fixed list. */
  topics: string[];
}

const answer = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      topics: z.array(z.string()).max(4).optional(),
    }),
  ),
});

/** True when at least one key is configured. Screens use it to decide what to offer. */
export function intelligenceAvailable(): boolean {
  return keyCount('gemini') > 0;
}

function prompt(channels: YouTubeChannel[]): string {
  const list = channels
    .map((channel) => {
      // Trimmed hard. The first couple of lines of a channel description carry
      // essentially all of the signal, and the rest is contact details and
      // links, which cost tokens and actively mislead.
      const about = (channel.description ?? '')
        .split(/\r?\n/)
        .filter((line) => !/[\w.+-]+@[\w-]+\.[\w.]+/.test(line) && !/^\s*https?:\/\//.test(line))
        .join(' ')
        .slice(0, 300);

      return `- id: ${channel.youtubeId}\n  name: ${channel.title}\n  about: ${about || '(none)'}`;
    })
    .join('\n');

  return `You are categorising YouTube channels for a personal content inbox.

For each channel choose exactly one category from this list:
${SLUGS.join(', ')}

Then give two or three narrow topics: lowercase, one or two words each, the
specific subject rather than the broad one. For a cricket channel that is
"cricket", not "sports". For a stand-up comedian, "stand-up" and "comedy".

Judge by what the channel actually publishes. Many creators end their
description with business or contact details; that never means the category is
business. Indian comedy, sketch, roast and vlog channels are entertainment.
Channels about matches, teams, leagues or players are sports.

If you genuinely cannot tell, use "other" rather than guessing.

Channels:
${list}

Reply with JSON only: {"results":[{"id":"...","category":"...","topics":["...","..."]}]}`;
}

/**
 * Classify a batch of channels. Returns null if no model could be reached.
 *
 * Every configured key is tried before giving up, because these are free-tier
 * keys whose per-minute limits are hit routinely and whose daily limits are hit
 * eventually. A key that reports exhaustion is rested until the quota day rolls
 * over rather than retried into the same wall.
 */
export async function classifyWithAI(channels: YouTubeChannel[]): Promise<Classification[] | null> {
  if (channels.length === 0) return [];
  const attempts = Math.max(keyCount('gemini'), 1);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const key = nextKey('gemini');
    if (!key) return null;

    try {
      const response = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt(channels) }] }],
          generationConfig: {
            // Classification is not a creative task, and a stable answer means
            // re-running it does not reshuffle the reader's categories.
            temperature: 0,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (response.status === 429 || response.status === 403) {
        // Rate limited or out of quota: park this key and try the next one.
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

      const known = new Set(channels.map((channel) => channel.youtubeId));
      return parsed.data.results
        .filter((row) => known.has(row.id))
        .map((row) => ({
          youtubeId: row.id,
          // The model is asked for a slug from the list, but it is not trusted
          // to have obeyed: anything unrecognised becomes "other" rather than
          // creating a category nobody defined.
          category: SLUGS.includes(row.category.toLowerCase()) ? row.category.toLowerCase() : 'other',
          topics: (row.topics ?? [])
            .map((topic) => topic.trim().toLowerCase())
            .filter((topic) => topic.length > 0 && topic.length <= 24)
            .slice(0, 3),
        }));
    } catch {
      // Network failure, timeout, malformed JSON: try the next key, and if
      // there are none left the caller falls back to the local heuristic.
      continue;
    }
  }

  return null;
}
