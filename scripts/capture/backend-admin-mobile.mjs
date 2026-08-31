/**
 * The Backend — admin walkthrough, mobile viewport.
 *
 * Records the admin dashboard at phone size for the case study's deep dive.
 *
 * The important part is WHAT IT RECORDS AGAINST. The working database holds
 * real clients, projects, invoices and messages; filming it would put client
 * names, email addresses and invoice amounts into a public portfolio video.
 * So this boots a SEPARATE server against a scrubbed database instead of
 * redacting afterwards — the process being filmed never loads a real record,
 * which is a guarantee rather than a best effort.
 *
 * Prepare that database first (once):
 *
 *   rm -f /tmp/nbc-capture-fake.db
 *   DATABASE_PATH=/tmp/nbc-capture-fake.db npm run migrate
 *   # then scrub: migrations seed rows of their own, including real client
 *   # references, so every identifying column is rewritten with placeholders.
 *   # See scripts/capture/README.md.
 *
 * Then:
 *   npm run build:server
 *   node scripts/capture/backend-admin-mobile.mjs
 *
 * The admin password is read from .env via process.env and never printed.
 *
 * KNOWN LIMITATION — this does not yet produce a usable clip.
 * The cookie satisfies the server, so /dashboard returns the admin's HTML, but
 * once the bundle mounts the client app redirects to /#/portal. This server
 * serves no SPA shell, so the recording ends on a blank document.
 *
 * What was established about that redirect:
 *   - It is NOT a rejected API call. A network trace shows the navigation with
 *     no request in front of it, and /api/admin/clients answers 200 to the
 *     cookie alone. So it is a local guard, not a 401.
 *   - The client's session state lives in sessionStorage under the nbw_auth_*
 *     keys (src/auth/auth-constants.ts). The localStorage names — admin_token,
 *     adminAuth — are the LEGACY set kept only for migration, so seeding those
 *     does nothing.
 *   - Seeding nbw_auth_user / _role / _expiry / _mode is still not enough, so
 *     something further is required that has not been identified.
 *
 * Blocking the bundle instead gets a styled page, but the server render alone
 * lays every subtab out at once, which does not read as the admin.
 *
 * The remaining option, and probably the better one: point a dev-mode frontend
 * at this server via VITE_API_URL and record that. It keeps the scrubbed
 * database while letting the SPA boot the way it normally does, instead of
 * reconstructing its session by hand.
 */
import { chromium } from '/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/node_modules/playwright/index.mjs';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';

const ORIGIN = process.env.CAPTURE_ORIGIN || 'http://localhost:4899';
const OUT_DIR = 'public/portfolio/the-backend/videos';
const OUT_NAME = 'walkthrough-admin-mobile.webm';
const WORK = process.env.CAPTURE_WORK || '/tmp/nbc-capture';

// Anything on screen that is not one of these is treated as a leak and the
// capture is thrown away. Kept deliberately tight.
const ALLOWED_TEXT = /example\.com|Sample Client|Example Studio|Demo Project|Placeholder/;

// Log in here rather than accepting cookies from the caller. Passing them in
// through the environment meant they could be from an earlier server process,
// and a stale auth_token does not fail loudly — /dashboard just redirects and
// the recording quietly captures the API's JSON root instead of the admin.
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) {
  console.error('ADMIN_PASSWORD is not set. Load .env before running this.');
  process.exit(1);
}
mkdirSync(WORK, { recursive: true });

// Reuse a cached session when one is still good. /admin/login is rate limited
// per IP, and re-running this script while iterating trips that limit long
// before anything is wrong with the credentials — the failure then looks like
// a bad password rather than too many attempts.
const SESSION_FILE = path.join(WORK, 'admin-session.json');
const sessionWorks = async (cookies) => {
  if (!cookies?.length) return false;
  const res = await fetch(`${ORIGIN}/dashboard`, {
    headers: { cookie: cookies.map((c) => c.split(';')[0]).join('; '), accept: 'text/html' },
    redirect: 'manual'
  });
  return res.status === 200 && /admin/i.test(await res.text());
};

let cookiesRaw = [];
let loginBody = null;
if (existsSync(SESSION_FILE)) {
  const cached = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
  if (await sessionWorks(cached)) {
    cookiesRaw = cached;
    console.log('  reusing cached admin session');
  }
}

if (!cookiesRaw.length) {
  const loginRes = await fetch(`${ORIGIN}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: adminPassword })
  });
  if (!loginRes.ok) {
    console.error(
      loginRes.status === 429
        ? '  admin login rate limited (429). Wait for the window to clear, or restart the capture server.'
        : `  admin login failed: ${loginRes.status}`
    );
    process.exit(1);
  }
  loginBody = await loginRes
    .clone()
    .json()
    .catch(() => null);
  cookiesRaw = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
  if (!cookiesRaw.length) {
    console.error('  login returned no cookies');
    process.exit(1);
  }
  writeFileSync(SESSION_FILE, JSON.stringify(cookiesRaw));
}

mkdirSync(WORK, { recursive: true });
const videoDir = path.join(WORK, 'backend-admin-mobile');
rmSync(videoDir, { recursive: true, force: true });
mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  recordVideo: { dir: videoDir, size: { width: 390, height: 844 } }
});

await ctx.addCookies(
  cookiesRaw.map((raw) => {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    return {
      name: pair.slice(0, idx).trim(),
      value: pair.slice(idx + 1).trim(),
      domain: 'localhost',
      path: '/'
    };
  })
);

const page = await ctx.newPage();

// The server renders the admin's HTML but serves no static files — in
// production Vercel does that, so on this origin every /assets/* 404s and the
// page paints as unstyled markup. Fulfil those from the local build rather
// than standing up a second origin, which would break the cookie.
//
// Narrow patterns, not a '**/*' catch-all: intercepting everything also puts
// this handler in front of the document and every API call, and one throw in
// there leaves the page blank with nothing in the console to explain it.
const ASSET_TYPES = {
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  woff2: 'font/woff2'
};
const serveFromBuild = async (route) => {
  try {
    const url = new URL(route.request().url());

    const file = path.join('dist', url.pathname.replace(/^\//, '').split('?')[0]);
    if (!existsSync(file)) {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: ASSET_TYPES[path.extname(file).slice(1)] || 'application/octet-stream',
      body: readFileSync(file)
    });
  } catch {
    return route.continue();
  }
};
for (const pattern of ['**/assets/**', '**/images/**', '**/fonts/**']) {
  await page.route(pattern, serveFromBuild);
}

const settle = (ms) => page.waitForTimeout(ms);

// The cookie satisfies the SERVER, which is why /dashboard returns the admin's
// HTML. The client app keeps its own session state and, finding none, redirects
// to /#/portal before issuing a single API call — the network trace shows the
// navigation with no request in front of it, so this is a local guard rather
// than a rejected call.
//
// That state lives in sessionStorage under the nbw_auth_* keys in
// src/auth/auth-constants.ts. The localStorage names (admin_token, adminAuth)
// are the LEGACY set kept only for migration, and seeding those does nothing.
if (loginBody?.data?.user) {
  await page.addInitScript(
    ({ user, expiry }) => {
      try {
        sessionStorage.setItem('nbw_auth_user', JSON.stringify(user));
        sessionStorage.setItem('nbw_auth_role', 'admin');
        sessionStorage.setItem('nbw_auth_expiry', String(expiry));
        sessionStorage.setItem('nbw_auth_mode', 'admin');
      } catch {
        /* storage unavailable — nothing to seed */
      }
    },
    { user: loginBody.data.user, expiry: Date.now() + 60 * 60 * 1000 }
  );
}

const navResp = await page.goto(`${ORIGIN}/dashboard`, { waitUntil: 'domcontentloaded' });
console.log('  nav:', navResp?.status(), page.url());
console.log('  cookies sent:', cookiesRaw.map((c) => c.split(';')[0].split('=')[0]).join(', '));
await settle(1500);
// Confirm we are actually on the admin. An expired session redirects to the
// SPA shell, which this server does not serve, leaving the API's JSON root on
// screen — a blank-looking recording with no error to explain it.
const landed = await page.evaluate(() => ({
  title: document.title,
  isJson: /^\s*\{/.test(document.body.innerText)
}));
if (landed.isJson || !/admin/i.test(landed.title)) {
  console.error(`  not on the admin after login (title: ${landed.title}). Aborting.`);
  await browser.close();
  process.exit(1);
}
await settle(3500);

// Walk the sidebar. Each tab gets a beat to render and a beat to be read —
// the point of the clip is that the admin has these screens, so it should
// linger long enough to see each one rather than strobe through them.
const tabs = await page.$$eval('.sidebar .nav-btn, [data-tab]', (els) =>
  els
    .map((el) => el.getAttribute('data-tab') || el.textContent.trim())
    .filter(Boolean)
    // Sign Out sits in the same sidebar list; clicking it would log the
    // session out mid-recording and end the clip on a login screen.
    .filter((t) => !/sign\s*out|log\s*out/i.test(t))
    .slice(0, 8)
);
console.log('  tabs found:', tabs.join(', ') || '(none)');

const leaks = [];
const scan = async (label) => {
  const text = await page.evaluate(() => document.body.innerText);
  // Flag anything that looks like a real email or a long digit run (invoice
  // totals, phone numbers) that is not one of the placeholders.
  for (const m of text.matchAll(/[\w.+-]+@[\w.-]+\.\w+/g)) {
    if (!ALLOWED_TEXT.test(m[0])) leaks.push(`${label}: ${m[0]}`);
  }
};

for (const tab of tabs) {
  const btn = page.locator(`.sidebar .nav-btn[data-tab="${tab}"], [data-tab="${tab}"]`).first();
  if (!(await btn.count())) continue;
  await btn.click({ force: true }).catch(() => {});
  await settle(2200);
  await scan(tab);
}
await settle(1200);

await ctx.close();
await browser.close();

if (leaks.length) {
  console.error('\n  ABORTED — real-looking data appeared on screen:');
  for (const l of [...new Set(leaks)].slice(0, 10)) console.error('    ' + l);
  console.error('  The recording was NOT written. Re-scrub the capture database.');
  process.exit(1);
}

const file = readdirSync(videoDir).find((f) => f.endsWith('.webm'));
if (!file) {
  console.error('  No video produced.');
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
renameSync(path.join(videoDir, file), path.join(OUT_DIR, OUT_NAME));
console.log(`\n  wrote ${OUT_DIR}/${OUT_NAME}`);
