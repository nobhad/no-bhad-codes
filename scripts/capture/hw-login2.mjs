import { chromium } from '/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/node_modules/playwright/index.mjs';
const BASE = 'http://localhost:3000';
const PROFILE = 'process.env.CAPTURE_WORK || '/tmp/nbc-capture'/hw-profile';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false, channel: 'chrome', viewport: { width: 1280, height: 860 }, args: ['--window-position=80,60']
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(BASE + '/admin/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
console.log('WAITING for sign-in (10 min). Closing the window early is fine — the profile is checked afterwards.');

const check = async () => {
  try {
    return await page.evaluate(() => {
      if (location.pathname.startsWith('/admin') && !location.pathname.includes('login')) return 'in';
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && /gotrue|netlify/i.test(k) && (localStorage.getItem(k) || '').includes('access_token')) return 'in';
        }
      } catch { /* ignore */ }
      return 'out';
    });
  } catch { return 'closed'; }
};

const deadline = Date.now() + 600000;
let state = 'timeout';
while (Date.now() < deadline) {
  const s = await check();
  if (s === 'closed') { state = 'closed'; break; }
  if (s === 'in') { state = 'in'; break; }
  await sleep(1500);
}
if (state === 'in') { await sleep(2500); console.log('SIGNED IN'); }
try { await ctx.close(); } catch { /* gone */ }
await sleep(1500);

// Whatever happened above, ask the profile itself whether it holds a session.
const verify = await chromium.launchPersistentContext(PROFILE, { headless: true, channel: 'chrome', viewport: { width: 1440, height: 900 } });
const vp = verify.pages()[0] || (await verify.newPage());
await vp.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' }).catch(() => {});
await sleep(3000);
console.log('PROFILE CHECK -> /admin lands on', vp.url(), vp.url().includes('login') ? '(NOT authenticated)' : '(AUTHENTICATED)');
await verify.close();
