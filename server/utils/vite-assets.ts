/**
 * Vite Asset Resolution
 *
 * The portal/auth pages are server-rendered EJS shells whose JS is bundled by
 * Vite. In development the Vite dev server serves the raw `/src/*.ts` source on
 * the fly, so templates can reference source paths directly. In production there
 * is no dev server — the frontend is a static Vite build (served by Vercel),
 * where every module is emitted as a content-hashed file under `/assets/`.
 *
 * These helpers bridge the two: given a source entry key (e.g. `src/admin.ts`),
 * `viteAsset()` returns `/src/admin.ts` in dev and the hashed `/assets/...` URL
 * in production (read from the Vite manifest). `viteEntryCss()` returns the
 * `<link>` tags for the CSS an entry imports, which Vite injects at runtime in
 * dev but must be linked explicitly in a production build.
 *
 * Hash parity: Vercel (assets) and Railway (this server, which reads the
 * manifest) both run `npm run build` from the same commit, so the hashed paths
 * this server emits match the files Vercel serves. Deploy them from the same
 * commit.
 */

import fs from 'node:fs';
import path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

/** Vite 5+ writes `dist/.vite/manifest.json`; older builds used `dist/manifest.json`. */
const MANIFEST_PATHS = [
  path.join(process.cwd(), 'dist', '.vite', 'manifest.json'),
  path.join(process.cwd(), 'dist', 'manifest.json')
];

interface ManifestChunk {
  file: string;
  css?: string[];
  imports?: string[];
  isEntry?: boolean;
}

let manifestCache: Record<string, ManifestChunk> | null = null;

function loadManifest(): Record<string, ManifestChunk> {
  if (manifestCache) return manifestCache;

  for (const manifestPath of MANIFEST_PATHS) {
    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      manifestCache = JSON.parse(raw) as Record<string, ManifestChunk>;
      return manifestCache;
    } catch {
      // Try the next candidate path.
    }
  }

  console.error(
    '[vite-assets] No Vite manifest found. Looked in:',
    MANIFEST_PATHS.join(', '),
    '— production asset paths will fall back to /src/* and 404. Did `npm run build` run?'
  );
  manifestCache = {};
  return manifestCache;
}

/** Normalize `/src/admin.ts` or `src/admin.ts` to the manifest key form `src/admin.ts`. */
function toKey(entry: string): string {
  return entry.replace(/^\/+/, '');
}

/**
 * Resolve a source entry to its servable URL.
 * Dev: the source path (Vite dev server transpiles it).
 * Prod: the content-hashed `/assets/...` path from the manifest.
 */
export function viteAsset(entry: string): string {
  const key = toKey(entry);
  if (!isProd) return `/${key}`;

  const chunk = loadManifest()[key];
  if (!chunk) {
    console.error(`[vite-assets] No manifest entry for "${key}". Is it a Rollup input in vite.config.ts?`);
    return `/${key}`;
  }
  return `/${chunk.file}`;
}

/**
 * Return `<link rel="stylesheet">` tags for the CSS an entry imports.
 * Dev: empty string — Vite injects entry CSS at runtime via the JS module.
 * Prod: one tag per file in the manifest chunk's `css` array.
 */
export function viteEntryCss(entry: string): string {
  if (!isProd) return '';

  const chunk = loadManifest()[toKey(entry)];
  if (!chunk?.css?.length) return '';

  return chunk.css.map((href) => `<link rel="stylesheet" href="/${href}" />`).join('\n');
}
