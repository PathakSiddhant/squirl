import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

/**
 * Generates the illustration behind the lock screen.
 *
 * Run with `npm run art:build`. It needs GEMINI_API_KEY in .env.local, which is
 * git-ignored, and it is the only thing in this project that talks to a
 * network. That happens here, once, at authoring time: the output is a static
 * file, and Squirl itself still never makes a request.
 *
 * The squirrel is deliberately NOT generated. The scene is drawn empty and the
 * real mark is composited onto the rock by the page, because a generated
 * squirrel would be a different animal from the one in the logo, sitting a few
 * hundred pixels away from the wordmark.
 */

const ROOT = process.cwd();
const OUT = join(ROOT, 'public', 'brand');
const MODEL = 'gemini-3-pro-image';

function apiKey() {
  const fromEnv = process.env.GEMINI_API_KEY;
  if (fromEnv) return fromEnv;

  const file = join(ROOT, '.env.local');
  if (!existsSync(file)) return null;
  const match = readFileSync(file, 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  return match ? match[1].trim() : null;
}

const PALETTE =
  'cream #F5F0E8, pale sage #C9CEC0, sage green #A8B5A0, deep forest #4A5648, ' +
  'near-black charcoal #262A26, burnt orange #E8722F';

const SCENES = {
  'threshold-day': `A flat vector editorial illustration of a calm minimalist landscape at golden hour.
Layered rolling hills receding into the distance in muted sage green and warm grey-green, the nearest
ridge deep charcoal. A large soft orange sun sitting low on the horizon, partly hidden behind the hills.
A pale winding river running from the middle distance down towards the viewer. In the lower left, a
large dark charcoal rock outcrop with a broad flat top. Slender rust-orange foliage sprigs growing in
the bottom left corner, and a few fine grass tufts along the riverbank. Three small birds far away in
the upper right. The entire upper half is empty, quiet, warm cream sky.`,

  'threshold-night': `A flat vector editorial illustration of the same calm minimalist landscape at night.
Layered rolling hills receding into the distance in deep desaturated blue-greens, the nearest ridge
almost black. A pale full moon low on the horizon, partly hidden behind the hills. A dim silver river
running from the middle distance down towards the viewer. In the lower left, a large near-black rock
outcrop with a broad flat top. Slender dark foliage sprigs in the bottom left corner. The entire upper
half is empty, quiet, deep indigo night sky.`,
};

const RULES = `
Vertical 3:4 composition. Flat shapes with a subtle risograph paper grain. Restrained, sophisticated,
editorial. Palette: ${PALETTE}.
Absolutely no text, no lettering, no watermark, no people, no animals, no characters of any kind.
No harsh gradients, no glow, no lens flare, no 3D rendering, no photorealism.
Leave the top-left third almost completely empty sky: type is set over it.`;

async function generate(name, prompt, key) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n${RULES}` }] }],
        generationConfig: { imageConfig: { aspectRatio: '3:4' } },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`${name}: ${response.status} ${(await response.text()).slice(0, 300)}`);
  }

  const body = await response.json();
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((part) => part.inlineData?.data);
  if (!image) {
    throw new Error(`${name}: no image in response. ${JSON.stringify(body).slice(0, 300)}`);
  }

  // WebP, because these are large flat illustrations and the PNG of one runs
  // to several megabytes for no visible gain.
  const raw = Buffer.from(image.inlineData.data, 'base64');
  const out = join(OUT, `${name}.webp`);
  await sharp(raw).webp({ quality: 88, effort: 6 }).toFile(out);

  const meta = await sharp(out).metadata();
  console.log(`  ${name}.webp  ${meta.width}x${meta.height}  ${Math.round(raw.length / 1024)}KB in`);
}

const key = apiKey();
if (!key) {
  console.log('No GEMINI_API_KEY. Skipping: the lock screen falls back to its drawn scene.');
  process.exit(0);
}

sharp.cache(false);
console.log(`generating threshold art with ${MODEL}`);
for (const [name, prompt] of Object.entries(SCENES)) {
  await generate(name, prompt, key);
}
console.log('done');
