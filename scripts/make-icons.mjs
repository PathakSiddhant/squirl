import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
  ['form_bg_remove.png', 'form-mark'],
  // The "_full" file is the tighter crop, oddly: the plain one still carries
  // the SIGNAL wordmark at low opacity, baked into the art rather than
  // trimmable as separate ink. This one is the icon alone.
  ['signal_bg_remove_full.png', 'signal-mark'],
]) {
  // Capped: nothing renders a mark taller than a launcher tile, and the Form
  // artwork trims to 1519px and a megabyte, which is a silly thing to keep.
  const { data, info } = await trim(source)
    .resize({ height: 640, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  writeFileSync(join(ROOT, 'public', 'brand', `${name}.png`), data);
  meta[name] = { width: info.width, height: info.height };
  console.log(`  ${name}.png  ${info.width}x${info.height}  ${Math.round(data.length / 1024)}KB`);
}

/*
  The wordmark on its own.

  The lockup is drawn stacked, squirrel over word, which is the wrong shape for
  a header that has to sit on one line. Rather than set SQUIRL in a typeface and
  hope it matches, the word is cut out of the real artwork: those letterforms
  are custom, and the nearest available face is visibly not-quite-right sitting
  next to the mark.

  The cut is found rather than hard-coded. The widest run of empty rows below
  the halfway point is the gap between the squirrel and the word, so everything
  under it is the word.
*/
{
  const source = join(ROOT, 'public', 'brand', 'lockup.png');
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const inked = [];
  for (let y = 0; y < info.height; y++) {
    let n = 0;
    for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 40) n++;
    inked.push(n);
  }

  let best = null;
  let run = null;
  for (let y = Math.floor(info.height * 0.4); y < info.height; y++) {
    if (inked[y] === 0) run = run ?? y;
    else if (run !== null) {
      const len = y - run;
      if (!best || len > best.len) best = { start: run, len };
      run = null;
    }
  }

  const top = best ? best.start + best.len : Math.floor(info.height * 0.75);
  const word = await sharp(source)
    .extract({ left: 0, top, width: info.width, height: info.height - top })
    .trim({ background: TRANSPARENT, threshold: 0 })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const size = await sharp(word).metadata();
  writeFileSync(join(ROOT, 'public', 'brand', 'wordmark.png'), word);
  meta.wordmark = { width: size.width, height: size.height };
  console.log(`  wordmark.png  ${size.width}x${size.height}`);
}

/*
  Signal's wordmark, cut from its own lockup.

  Same technique as Squirl's above, and for the same reason: those letterforms
  are drawn, and the nearest available typeface set beside the mark is visibly
  not-quite-right. The artwork stacks the icon over the word, so the widest run
  of empty rows below the halfway point is the gap between them, and everything
  under it is the word.
*/
{
  const source = join(ROOT, 'brand-assets', 'Signal_full.png');
  if (existsSync(source)) {
    // This source has a cream background rather than transparency, so the ink
    // is found by darkness instead of by alpha.
    const { data, info } = await sharp(source).greyscale().raw().toBuffer({ resolveWithObject: true });

    const inked = [];
    for (let y = 0; y < info.height; y++) {
      let n = 0;
      for (let x = 0; x < info.width; x++) if (data[y * info.width + x] < 150) n++;
      inked.push(n);
    }

    let best = null;
    let run = null;
    for (let y = Math.floor(info.height * 0.4); y < info.height; y++) {
      if (inked[y] === 0) run = run ?? y;
      else if (run !== null) {
        const len = y - run;
        if (!best || len > best.len) best = { start: run, len };
        run = null;
      }
    }

    if (best) {
      const top = best.start + best.len;
      const word = await sharp(source)
        .extract({ left: 0, top, width: info.width, height: info.height - top })
        .toBuffer();

      // Cream to transparent, so the word sits on any surface in either theme.
      const { data: px, info: shape } = await sharp(word).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < px.length; i += 4) {
        const light = (px[i] + px[i + 1] + px[i + 2]) / 3;
        // Ink stays opaque, paper goes clear, and the edge in between keeps a
        // proportional alpha so the letterforms do not come out jagged.
        px[i + 3] = light > 235 ? 0 : light < 120 ? 255 : Math.round(255 * (235 - light) / 115);
      }

      const cut = await sharp(px, { raw: { width: shape.width, height: shape.height, channels: 4 } })
        .trim({ background: TRANSPARENT, threshold: 0 })
        .png({ compressionLevel: 9 })
        .toBuffer();

      const size = await sharp(cut).metadata();
      writeFileSync(join(ROOT, 'public', 'brand', 'signal-wordmark.png'), cut);
      meta['signal-wordmark'] = { width: size.width, height: size.height };
      console.log(`  signal-wordmark.png  ${size.width}x${size.height}`);
    }
  }
}

writeFileSync(join(ROOT, 'lib', 'brand.json'), `${JSON.stringify(meta, null, 2)}\n`);

/*
  The threshold illustrations.

  Not trimmed and not treated like a mark: these are full-bleed artwork, and
  the page crops them itself. They arrive as ~2MB PNGs, which is an absurd
  thing to make someone download to look at a sign-in screen, so they are
  re-encoded to WebP at roughly a tenth of that with no visible difference.

  Day and night are one matched pair: same composition, same rock, same
  squirrel, so switching between them by the hour never moves anything.
*/
console.log('encoding threshold art');
for (const [source, name] of [
  ['day_squirl_bg.png', 'threshold-day'],
  ['night_bg.png', 'threshold-night'],
]) {
  const from = join(ROOT, 'brand-assets', source);
  if (!existsSync(from)) {
    console.log(`  ${source} missing, skipped`);
    continue;
  }

  const out = join(ROOT, 'public', 'brand', `${name}.webp`);
  await sharp(from).webp({ quality: 86, effort: 6 }).toFile(out);

  const { width, height, size } = await sharp(out).metadata();
  console.log(`  ${name}.webp  ${width}x${height}  ${Math.round((size ?? 0) / 1024)}KB`);
}

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
