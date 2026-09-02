import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

/**
 * Builds every brand asset the app serves, from the artwork in brand-assets.
 *
 * Run with `npm run brand:build` after changing the source artwork.
 *
 * Two things happen here that matter:
 *
 * 1. The source PNGs are 1508x1043 with a lot of transparent padding, so the
 *    drawn mark is only 646x608 of that. Laying them out at their file
 *    dimensions reserves a box that is mostly empty, which is why the logo
 *    looked small and low quality on screen. Everything is trimmed to its ink
 *    first, and the real dimensions are written to brand.json so the
 *    components reserve exactly the right box.
 *
 * 2. Icons are generated and committed rather than rendered at request time.
 *    Compositing a 1.5 megapixel PNG inside a Next `ImageResponse` route
 *    pushes a ~500KB base64 string through the JSX renderer, which exhausts
 *    the stack in Next's build workers and kills the build outright.
 */

const ROOT = process.cwd();
const CHARCOAL = { r: 0x22, g: 0x26, b: 0x2b, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * libvips caches the result of every operation it performs. Across several
 * multi-megapixel PNGs plus the icon composites, that cache reaches its
 * allocation ceiling and the next trim dies with "vips_tracked: out of
 * memory". This is a one-shot build script, so there is nothing to gain from
 * caching and everything to gain from bounded memory.
 */
sharp.cache(false);

const trim = (file) => sharp(join(ROOT, 'brand-assets', file)).trim({ background: TRANSPARENT, threshold: 0 });

mkdirSync(join(ROOT, 'public', 'brand'), { recursive: true });
const meta = {};

console.log('trimming artwork to its ink');
for (const [source, name] of [
  ['squirl-mark.png', 'mark'],
  ['squirl-lockup.png', 'lockup'],
  // Each application brings its own mark. Squirl's identity stays the
  // squirrel; an application's mark is only ever used to identify that
  // application, on its launcher card and in its own header.
  ['Ledger_remove_bg.png', 'ledger-mark'],
]) {
  const { data, info } = await trim(source)
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  writeFileSync(join(ROOT, 'public', 'brand', `${name}.png`), data);
  meta[name] = { width: info.width, height: info.height };
  console.log(`  ${name}.png  ${info.width}x${info.height}  ${Math.round(data.length / 1024)}KB`);
}

writeFileSync(join(ROOT, 'lib', 'brand.json'), `${JSON.stringify(meta, null, 2)}\n`);

/** Fraction of an icon canvas the mark fills. Maskable leaves the safe area. */
const FILL = { normal: 0.72, maskable: 0.54 };

async function icon(size, outPath, fill) {
  const mark = await trim('squirl-mark.png')
    .resize({ width: Math.round(size * fill), fit: 'inside' })
    .toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background: CHARCOAL } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(`  ${outPath.split(/[\\/]/).slice(-2).join('/')}  ${size}x${size}`);
}

console.log('building icons');
await icon(512, join(ROOT, 'app', 'icon.png'), FILL.normal);
await icon(180, join(ROOT, 'app', 'apple-icon.png'), FILL.normal);
await icon(192, join(ROOT, 'public', 'brand', 'icon-192.png'), FILL.normal);
await icon(512, join(ROOT, 'public', 'brand', 'icon-512.png'), FILL.normal);
await icon(512, join(ROOT, 'public', 'brand', 'icon-maskable.png'), FILL.maskable);
console.log('done');
