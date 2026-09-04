/**
 * ===============================================
 * MEDIA DIMENSIONS MANIFEST
 * ===============================================
 * @file scripts/build-media-dimensions.mjs
 *
 * Reads the intrinsic size of every image portfolio.json points at and writes
 * src/generated/media-dimensions.ts.
 *
 * Why this exists: the case-study screenshots are rendered from data, so their
 * <img> tags carry no width/height — and they are loading="lazy", which means
 * the browser allocates a 0x0 box until the file arrives and then shoves
 * everything below it down the page. Chrome's own audit flags it ("Lazy-loaded
 * images should have explicit dimensions"). The fix needs the real dimensions
 * at render time, and the only place they exist is inside the files.
 *
 * Dependency-free on purpose. The four formats in use are PNG, GIF, WebP and
 * JPEG, and their headers are a few bytes each — cheaper than adding sharp to
 * devDependencies for fourteen files that change once a season.
 *
 * Run: npm run media:dimensions   (output is committed, like the design-system
 * docs — regenerate when portfolio media changes)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const OUT = join(ROOT, 'src/generated/media-dimensions.ts');
const THEME_TOKEN = '{theme}';
const THEMES = ['light', 'dark'];

/** PNG: IHDR is always the first chunk; width/height are big-endian u32. */
function png(b) {
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

/** GIF: logical screen descriptor, little-endian u16 pair at byte 6. */
function gif(b) {
  if (b.toString('ascii', 0, 3) !== 'GIF') return null;
  return [b.readUInt16LE(6), b.readUInt16LE(8)];
}

/**
 * WebP: a RIFF container with three body formats.
 *   VP8  (lossy)    — 14-bit dimensions after the 3-byte start code
 *   VP8L (lossless) — 14 bits each, packed across four bytes
 *   VP8X (extended) — 24-bit canvas size, minus one
 */
function webp(b) {
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fourcc = b.toString('ascii', 12, 16);
  if (fourcc === 'VP8 ') {
    return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  if (fourcc === 'VP8L') {
    const n = b.readUInt32LE(21);
    return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1];
  }
  if (fourcc === 'VP8X') {
    const w = b[24] | (b[25] << 8) | (b[26] << 16);
    const h = b[27] | (b[28] << 8) | (b[29] << 16);
    return [w + 1, h + 1];
  }
  return null;
}

/** JPEG: walk the segment chain to the first SOF marker. */
function jpeg(b) {
  if (b.readUInt16BE(0) !== 0xffd8) return null;
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marker = b[i + 1];
    // SOF0-SOF15, skipping the four that are not frame headers.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

function measure(file) {
  const b = readFileSync(file);
  for (const read of [png, gif, webp, jpeg]) {
    const size = read(b);
    if (size && size[0] > 0 && size[1] > 0) return size;
  }
  return null;
}

// ── collect every image path in the data, both theme variants ──────────────
const data = JSON.parse(readFileSync(join(PUBLIC, 'data/portfolio.json'), 'utf8'));
const paths = new Set();
const walk = (node) => {
  if (!node) return;
  if (typeof node === 'string') {
    if (/\.(png|jpe?g|gif|webp|avif)$/i.test(node)) {
      if (node.includes(THEME_TOKEN)) {
        for (const t of THEMES) paths.add(node.split(THEME_TOKEN).join(t));
      } else {
        paths.add(node);
      }
    }
    return;
  }
  if (Array.isArray(node)) return node.forEach(walk);
  if (typeof node === 'object') return Object.values(node).forEach(walk);
};
walk(data);

const dims = {};
const missing = [];
for (const p of [...paths].sort()) {
  const file = join(PUBLIC, p.replace(/^\//, ''));
  if (!existsSync(file)) { missing.push(`${p} (no such file)`); continue; }
  const size = measure(file);
  if (!size) { missing.push(`${p} (unreadable header)`); continue; }
  dims[p] = size;
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `/**
 * GENERATED — do not edit. Run \`npm run media:dimensions\`.
 *
 * Intrinsic pixel size of every image referenced by public/data/portfolio.json,
 * so the case-study renderer can put width/height on its lazy <img> tags and
 * the browser reserves the right box before the file arrives.
 *
 * Keys are the paths exactly as they appear in the data, with {theme} already
 * expanded to each variant.
 */
export const MEDIA_DIMENSIONS: Readonly<Record<string, readonly [number, number]>> = {
${Object.entries(dims).map(([k, [w, h]]) => `  '${k}': [${w}, ${h}]`).join(',\n')}
};

/** width/height attributes for an <img>, or '' when the file is not in the map. */
export function mediaSizeAttrs(path: string): string {
  const size = MEDIA_DIMENSIONS[path];
  return size ? \` width="\${size[0]}" height="\${size[1]}"\` : '';
}
`);

console.log(`media dimensions → src/generated/media-dimensions.ts  (${Object.keys(dims).length} images)`);
for (const [k, v] of Object.entries(dims)) console.log(`  ${String(v[0]).padStart(5)} x ${String(v[1]).padEnd(5)}  ${k}`);
if (missing.length) {
  console.log('\nSkipped:');
  for (const m of missing) console.log('  ' + m);
}
