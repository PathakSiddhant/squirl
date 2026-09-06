import 'server-only';

/**
 * Finding a picture of a food.
 *
 * ## Why Wikipedia
 *
 * The brief for Form is explicit that it must not grow a second external
 * backend or ask for another API key, and every image service worth the name
 * wants one. Wikipedia's API wants neither: it is public, unauthenticated,
 * rate-limits politely, and its article lead images are exactly the thing being
 * asked for — one clear photograph of the subject, already cropped square-ish
 * by the thumbnail renderer.
 *
 * It is also the only source here that can be relied on not to disappear or
 * start charging, which matters for a local-first application that is supposed
 * to still work in five years.
 *
 * ## Fetched once, then owned
 *
 * The bytes are pulled down and stored in the row, not linked. After the first
 * lookup the food never touches the network again — the library renders with
 * the machine offline, and nothing in the application depends on Wikipedia
 * being up. A failed lookup is not an error anybody needs to see: the food
 * simply keeps its icon.
 */

const AGENT = 'Squirl-Form/1.0 (personal local app)';
const TIMEOUT_MS = 6000;
const MAX_BYTES = 400_000;

async function get(url: string): Promise<Response | null> {
  try {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetch(url, { signal, headers: { 'user-agent': AGENT } });
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

/**
 * The search term.
 *
 * Library names carry qualifiers a search engine only trips over — "Toor dal,
 * cooked", "Milk (full fat)", a brand in brackets. The part before the first
 * comma or bracket is almost always the food itself.
 */
function term(name: string): string {
  return name
    .split(/[,(]/)[0]
    .replace(/\b(cooked|raw|dry|boiled|fresh|low fat|full fat|skimmed|plain)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Thumb {
  source: string;
  width: number;
}

/** Wikipedia's own lead image for the best-matching article. */
async function fromWikipedia(query: string): Promise<string | null> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=pageimages&piprop=thumbnail&pithumbsize=400' +
    `&generator=search&gsrlimit=3&gsrsearch=${encodeURIComponent(query)}`;

  const response = await get(url);
  if (!response) return null;

  const body = (await response.json()) as {
    query?: { pages?: Record<string, { thumbnail?: Thumb; index?: number }> };
  };

  const pages = Object.values(body.query?.pages ?? {});
  // The generator returns results out of order; `index` is the search rank.
  pages.sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  return pages.find((page) => page.thumbnail?.source)?.thumbnail?.source ?? null;
}

/** Commons, for anything Wikipedia has an article about but no picture on. */
async function fromCommons(query: string): Promise<string | null> {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=imageinfo&iiprop=url&iiurlwidth=400' +
    `&generator=search&gsrnamespace=6&gsrlimit=3&gsrsearch=${encodeURIComponent(query)}`;

  const response = await get(url);
  if (!response) return null;

  const body = (await response.json()) as {
    query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string }> }> };
  };

  for (const page of Object.values(body.query?.pages ?? {})) {
    const thumb = page.imageinfo?.[0]?.thumburl;
    if (thumb) return thumb;
  }
  return null;
}

/** Download and inline, refusing anything that is not a reasonably sized image. */
async function inline(source: string): Promise<string | null> {
  const response = await get(source);
  if (!response) return null;

  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/') || type.includes('svg')) return null;

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null;

  return `data:${type.split(';')[0]};base64,${Buffer.from(buffer).toString('base64')}`;
}

/**
 * A picture for this food, or null.
 *
 * Never throws. Every failure — no network, no match, an SVG, something the
 * size of a poster — comes back as null, and the caller carries on.
 */
export async function findImage(name: string): Promise<string | null> {
  const query = term(name);
  if (query.length < 2) return null;

  const source = (await fromWikipedia(query)) ?? (await fromCommons(query));
  return source ? inline(source) : null;
}
