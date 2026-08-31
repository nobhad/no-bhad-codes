/**
 * Post-deploy smoke check against the live site.
 *
 * Verifies both hosts in one pass, since they deploy independently:
 *   - Vercel   serves the static site
 *   - Railway  serves everything vercel.json rewrites to it (/api, /portal,
 *              /intake, /dashboard, /client, the password flows)
 *
 * The asset check is the important one. Railway emits asset URLs but Vercel
 * serves the files, so a hash mismatch between the two shows up as a page that
 * returns 200 while its CSS and JS 404 — which no status-code check would catch.
 * This resolves the real hrefs out of the served HTML and fetches them.
 *
 * Usage:
 *   node scripts/post-deploy-check.mjs [origin]     # default https://www.nobhad.codes
 */
// The apex 307s to www, so www is the canonical origin to probe.
const ORIGIN = (process.argv[2] || 'https://www.nobhad.codes').replace(/\/$/, '');
const TIMEOUT_MS = 20000;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(46)} ${detail}`);
}

async function get(path, accept = 'text/html') {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ORIGIN + path, {
      headers: { accept, 'user-agent': 'post-deploy-check' },
      // Follow redirects: a login redirect is a valid answer for /portal, and
      // the apex-to-www hop would otherwise mask every result behind a 307.
      redirect: 'follow',
      signal: ctrl.signal
    });
    const body = res.headers.get('content-type')?.includes('json')
      ? await res.text()
      : await res.text();
    return { status: res.status, body, headers: res.headers };
  } catch (err) {
    return { status: 0, body: '', error: String(err.message || err) };
  } finally {
    clearTimeout(t);
  }
}

console.log(`\nPost-deploy check against ${ORIGIN}\n`);

// ---- Vercel: the static site ------------------------------------------------
console.log('Vercel (static site)');
const home = await get('/');
record(
  'home responds',
  home.status === 200,
  `status=${home.status}${home.error ? ' ' + home.error : ''}`
);
record('home is the site', /no bhad codes/i.test(home.body), `${home.body.length} bytes`);

// Resolve the real asset URLs out of the HTML and fetch them. A stale hash
// returns 200 for the page and 404 for everything it needs.
const assetHrefs = [...home.body.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
const uniqueAssets = [...new Set(assetHrefs)].slice(0, 8);
let assetFails = 0;
for (const a of uniqueAssets) {
  const r = await get(a, '*/*');
  if (r.status !== 200) assetFails++;
}
record(
  'referenced assets load',
  uniqueAssets.length > 0 && assetFails === 0,
  `${uniqueAssets.length - assetFails}/${uniqueAssets.length} returned 200`
);

const manifest = await get('/.vite/manifest.json', 'application/json');
record('authoritative manifest served', manifest.status === 200, `status=${manifest.status}`);

// ---- Railway: everything proxied through --------------------------------------
console.log('\nRailway (API + server-rendered pages)');
for (const [path, want] of [
  ['/intake', [200]],
  ['/portal', [200, 302, 303]],
  ['/dashboard', [200, 302, 303]],
  ['/forgot-password', [200]],
  ['/set-password', [200]]
]) {
  const r = await get(path);
  record(`${path}`, want.includes(r.status), `status=${r.status}${r.error ? ' ' + r.error : ''}`);
}

const apiHealth = await get('/api/health', 'application/json');
record(
  '/api/health reachable',
  apiHealth.status > 0 && apiHealth.status < 500,
  `status=${apiHealth.status}`
);

// ---- The 404, which this release changed --------------------------------------
console.log('\n404 page (changed this release)');
const notFound = await get('/definitely-not-a-real-page-' + Date.now());
record('returns 404', notFound.status === 404, `status=${notFound.status}`);
record(
  'renders the site shell',
  /<header/i.test(notFound.body),
  `header present: ${/<header/i.test(notFound.body)}`
);
// Vite emits `rel="stylesheet" crossorigin href="..."`, so allow attributes
// between the two rather than requiring them adjacent.
const cssHref = notFound.body.match(/rel="stylesheet"[^>]*?href="([^"]+)"/)?.[1];
if (cssHref) {
  const css = await get(cssHref, 'text/css');
  record('404 stylesheet actually loads', css.status === 200, `${cssHref} -> ${css.status}`);
} else {
  record('404 stylesheet actually loads', false, 'no stylesheet link found in the 404 HTML');
}

// ---- Railway's own 404, which this release switched to an EJS render ---------
// Before this release both hosts served the same static dist/404.html, so the
// two were byte-identical. Afterwards Railway renders through layouts/auth,
// which stamps data-view="not-found" on the body — a marker the static file
// never carries. That is the signal the new 404 is actually live.
console.log('\nRailway-rendered 404 (proxied path)');
const proxied = await get('/client/definitely-missing-' + Date.now());
record('proxied 404 responds', proxied.status === 404, `status=${proxied.status}`);
const isEjsRendered = /data-view="not-found"/.test(proxied.body);
record(
  'served by the EJS shell, not the static file',
  isEjsRendered,
  isEjsRendered
    ? 'data-view="not-found" present'
    : 'still the static dist/404.html (expected until this release deploys)'
);
const proxiedCss = proxied.body.match(/rel="stylesheet"[^>]*?href="([^"]+)"/)?.[1];
if (proxiedCss) {
  const r = await get(proxiedCss, 'text/css');
  record(
    'its stylesheet resolves on the static host',
    r.status === 200,
    `${proxiedCss} -> ${r.status}`
  );
} else {
  record('its stylesheet resolves on the static host', false, 'no stylesheet link found');
}

// ---- Verdict -------------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${failed.length === 0 ? 'ALL CHECKS PASSED' : `${failed.length} CHECK(S) FAILED`} — ${results.length - failed.length}/${results.length}\n`
);
if (failed.length) {
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  console.log();
}
process.exit(failed.length ? 1 : 0);
