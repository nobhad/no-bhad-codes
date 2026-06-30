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
 * in production. `viteEntryCss()` returns the `<link>` tags for the CSS an entry
 * imports, which Vite injects at runtime in dev but must be linked explicitly in
 * a production build.
 *
 * Hash parity (the hard part):
 *   This server runs on Railway and emits asset URLs, but the files themselves
 *   are served by Vercel. Railway and Vercel build `dist/` independently, so
 *   their content hashes only match if the builds are byte-identical — a fragile
 *   assumption that has broken on toolchain drift (obfuscator RNG seed, Node
 *   version). When the hashes diverge, Railway emits URLs Vercel doesn't have and
 *   the portal 404s its JS.
 *
 *   To make correctness independent of build reproducibility, in production this
 *   module resolves hashes from the *authoritative* manifest — the one Vercel
 *   actually serves at `${PUBLIC_ASSET_ORIGIN}/.vite/manifest.json` — fetched at
 *   boot, cached, and refreshed periodically. Railway therefore emits exactly the
 *   hashes Vercel serves, even if Railway's own build produced different bytes.
 *   The local `dist/.vite/manifest.json` is the fallback if the remote manifest
 *   is unreachable. Node pinning keeps the builds reproducible as the first line
 *   of defense; the remote manifest is the safety net.
 */

import fs from 'node:fs';
import path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

/** Vite 5+ writes `dist/.vite/manifest.json`; older builds used `dist/manifest.json`. */
const MANIFEST_PATHS = [
  path.join(process.cwd(), 'dist', '.vite', 'manifest.json'),
  path.join(process.cwd(), 'dist', 'manifest.json')
];

/**
 * Origin that serves the static Vite build (Vercel). Its `/.vite/manifest.json`
 * is authoritative for what is actually served. Configurable so staging/preview
 * hosts can point elsewhere; defaults to the production site.
 */
const PUBLIC_ASSET_ORIGIN = (
  process.env.PUBLIC_ASSET_ORIGIN ||
  process.env.WEBSITE_URL ||
  'https://www.nobhad.codes'
).replace(/\/+$/, '');

const REMOTE_MANIFEST_URL = `${PUBLIC_ASSET_ORIGIN}/.vite/manifest.json`;

/** Re-fetch the authoritative manifest this often, so a new deploy is picked up. */
const REMOTE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** Bound the boot fetch so a slow/hung CDN can't stall startup. */
const REMOTE_FETCH_TIMEOUT_MS = 8 * 1000;

interface ManifestChunk {
  file: string;
  css?: string[];
  imports?: string[];
  isEntry?: boolean;
}

type Manifest = Record<string, ManifestChunk>;

let localManifestCache: Manifest | null = null;
let remoteManifestCache: Manifest | null = null;

function loadLocalManifest(): Manifest {
  if (localManifestCache) return localManifestCache;

  for (const manifestPath of MANIFEST_PATHS) {
    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      localManifestCache = JSON.parse(raw) as Manifest;
      return localManifestCache;
    } catch {
      // Try the next candidate path.
    }
  }

  console.error(
    '[vite-assets] No local Vite manifest found. Looked in:',
    MANIFEST_PATHS.join(', '),
    '— production asset paths will fall back to /src/* and 404. Did `npm run build` run?'
  );
  localManifestCache = {};
  return localManifestCache;
}

/**
 * Active manifest for resolution: the authoritative remote one if it has loaded,
 * otherwise the local build's manifest.
 */
function activeManifest(): Manifest {
  return remoteManifestCache ?? loadLocalManifest();
}

/**
 * Fetch the authoritative manifest Vercel serves and cache it. On any failure the
 * existing cache (remote or local) is left intact — a transient CDN hiccup must
 * never blank out asset resolution.
 */
async function refreshRemoteManifest(): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(REMOTE_MANIFEST_URL, {
        signal: controller.signal,
        headers: { accept: 'application/json' }
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      console.error(`[vite-assets] Remote manifest ${REMOTE_MANIFEST_URL} returned ${res.status}; keeping current manifest.`);
      return;
    }

    const parsed = (await res.json()) as Manifest;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error('[vite-assets] Remote manifest was not a JSON object; keeping current manifest.');
      return;
    }

    const wasUnset = remoteManifestCache === null;
    remoteManifestCache = parsed;
    if (wasUnset) {
      console.log(`[vite-assets] Loaded authoritative manifest from ${REMOTE_MANIFEST_URL} (${Object.keys(parsed).length} entries).`);
    }
  } catch (err) {
    console.error(`[vite-assets] Failed to fetch remote manifest ${REMOTE_MANIFEST_URL}; using local fallback.`, err);
  }
}

let initialized = false;

/**
 * Start authoritative-manifest resolution. Called once at server boot. Fetches
 * the remote manifest immediately and then on an interval so new deploys are
 * picked up without a restart. No-op in development. The returned promise
 * resolves once the first fetch attempt completes, so callers may await it before
 * serving if they want the authoritative manifest in place from the first request
 * (not required — resolution falls back to the local manifest until then).
 */
export function initViteAssets(): Promise<void> {
  if (!isProd || initialized) return Promise.resolve();
  initialized = true;

  const first = refreshRemoteManifest();

  const interval = setInterval(() => {
    void refreshRemoteManifest();
  }, REMOTE_REFRESH_INTERVAL_MS);
  // Don't keep the event loop alive solely for the refresh timer.
  if (typeof interval.unref === 'function') interval.unref();

  return first;
}

/** Normalize `/src/admin.ts` or `src/admin.ts` to the manifest key form `src/admin.ts`. */
function toKey(entry: string): string {
  return entry.replace(/^\/+/, '');
}

/**
 * Resolve a source entry to its servable URL.
 * Dev: the source path (Vite dev server transpiles it).
 * Prod: the content-hashed `/assets/...` path from the authoritative manifest.
 */
export function viteAsset(entry: string): string {
  const key = toKey(entry);
  if (!isProd) return `/${key}`;

  const chunk = activeManifest()[key];
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

  const chunk = activeManifest()[toKey(entry)];
  if (!chunk?.css?.length) return '';

  return chunk.css.map((href) => `<link rel="stylesheet" href="/${href}" />`).join('\n');
}
