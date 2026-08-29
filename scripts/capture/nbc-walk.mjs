import { chromium } from '/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const SP = process.env.SP;
const BASE = 'http://localhost:4000';
const THEME = process.argv[2] || 'light';
const VIEW = process.argv[3] || 'desktop';
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const viewport = VIEWPORTS[VIEW];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = path.join(SP, `nbc-walk-${THEME}-${VIEW}`);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const ctx = await browser.newContext({ viewport, recordVideo: { dir, size: viewport } });
await ctx.addCookies([{ name: 'tracking_consent', value: 'accepted', url: BASE }]);
await ctx.addInitScript((tv) => {
  try { localStorage.setItem('theme', tv); } catch { /* ignore */ }
  document.documentElement.setAttribute('data-theme', tv);
}, THEME);
const page = await ctx.newPage();
// Recording starts when the context is created, before the first paint, and
// in dev the first thing painted is the unstyled document — Vite injects CSS
// through JS. Mark the moment styling lands so the encode can cut to it; a
// content test cannot tell that frame apart from a real one, since it is full
// of text.
const t0 = Date.now();

const key = async (k, settle = 1600) => {
  await page.evaluate((kk) => document.dispatchEvent(new KeyboardEvent('keydown', { key: kk, bubbles: true })), k);
  await wait(settle);
};

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => !!getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim(),
  null, { timeout: 15000 }
).catch(() => {});
await page.evaluate(() => document.querySelectorAll('.consent-banner').forEach((el) => el.remove()));
const styledAt = (Date.now() - t0) / 1000;
fs.writeFileSync(path.join(dir, 'styledAt.txt'), String(styledAt));
console.log('styles land at', styledAt.toFixed(2), 's');

// 1. HOME — the intro plays itself, then the card flips.
//
// Wait for the END of the intro, not the middle. introComplete turns true at
// ~2.2s while the intro-finished class only lands at ~4.1s and the morph
// overlay is not clear until ~4.5s, so waiting on it flipped the card while
// the paw was still retracting.
await page.waitForFunction(
  () => {
    if (!document.documentElement.classList.contains('intro-finished')) return false;
    const ov = document.querySelector('#intro-morph-overlay');
    if (!ov) return true;
    const cs = getComputedStyle(ov);
    return cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none';
  },
  null,
  { timeout: 30000 }
).catch(() => {});
await wait(1400);
const card = await page.locator('#business-card').boundingBox().catch(() => null);
if (card) {
  // Once each way. The direction comes from which half is clicked
  // (business-card-interactions.ts: clickX < cardCenterX -> 'left'), so the
  // right half turns it out and the left half turns it back.
  await page.mouse.click(card.x + card.width * 0.78, card.y + card.height / 2);
  await wait(2400);
  await page.mouse.click(card.x + card.width * 0.22, card.y + card.height / 2);
  await wait(2200);
}

// The footer belongs to home only. It is the same band on every tile, so
// showing it once is the point — raising it again on about or contact would
// just be the same reveal a second and third time.
await key('ArrowDown', 1900);   // curtain up, footer on camera
await wait(350);                // long enough to read, not to sit on
await key('ArrowUp', 1700);     // and back down before moving on

// 2. ABOUT — toolkit marquee, no footer.
await key('ArrowRight', 2600);
await wait(2600);

// 3. PROJECTS — the TV, tuned in to a channel so the title card plays.
await key('ArrowRight', 2600);
await wait(1500);
await key('ArrowDown', 3000);   // channel 01 -> 02, tune-in sequence
// Let the tune-in run to the tagline — "You're looking at it!" — and go into
// the case study from there, which is the invitation that panel is making.
await page.waitForFunction(
  () => {
    const p = document.querySelector('.crt-tv__panel[data-panel-key="tagline"]');
    return !!p && parseFloat(getComputedStyle(p).opacity) > 0.9;
  },
  null,
  { timeout: 30000 }
).catch(() => {});
await wait(3200);
const screen = await page.locator('.crt-tv__screen').boundingBox().catch(() => null);
if (screen) {
  await page.mouse.click(screen.x + screen.width / 2, screen.y + screen.height * 0.82);
  await wait(3200);            // the case study slides down from the TV

  // Ride the carousel rather than sitting on one page waiting for its hero
  // to loop: the arrows are the thing worth showing here, and each project
  // introduces itself as it arrives.
  for (let i = 0; i < 2; i++) {
    await key('ArrowRight', 2800);
    await wait(1800);
  }
  await key('ArrowRight', 2800);
  await wait(1600);
}

// Back up to the projects tile before leaving. ArrowUp is the way out of a
// case study — it lifts the TV back down over the top and resumes the channel
// the reader was on — so the tour returns the way a visitor would rather than
// cutting sideways to another page.
await key('ArrowUp', 3200);
await wait(2600);

// 4. CONTACT — a plain map move now that the tour is back on the tile.
await key('ArrowRight', 2800);
await wait(2400);

// 5. TERMINAL INTAKE — opened from the contact page rather than by loading
//    /intake directly. That route renders the terminal full-bleed; the modal
//    is what a visitor actually gets, and it is the right width on camera.
await page.locator('#open-intake-link').click({ timeout: 5000 }).catch(() => {});
await page.waitForSelector('#terminalInput', { timeout: 15000 }).catch(() => {});
await wait(6000); // the terminal boots before it will take input

// Choices are typed, not clicked. The prompt says "enter a number (1-7) or
// click an option" and parseSelectInput takes the number; clicking the chips
// did not register and the recording carried two [ERROR] lines because of it.
// Enough to show the terminal working — a typed answer, an answer it
// validates, and a list answered by number. Running the form to the end
// would add half a minute of typing to prove nothing further.
const INTAKE = ['Noelle', 'hello@nobhad.codes', '1'];
for (const answer of INTAKE) {
  await page.locator('#terminalInput').click({ timeout: 4000 }).catch(() => {});
  await page.locator('#terminalInput').type(answer, { delay: 55 }).catch(() => {});
  await page.keyboard.press('Enter');
  await wait(1500);
}
// The one thing that must hold: nothing in the terminal errored on camera.
const errored = await page.evaluate(() =>
  /invalid|error|\[ERROR\]/i.test(document.body.innerText)
);
console.log('intake errors on camera:', errored ? '** YES **' : 'none');
await wait(2000);

// Close the intake before moving on — Escape is what the page listens for,
// and leaving the modal open would put the portal behind it.
await page.keyboard.press('Escape');
await wait(1800);

// 6. PORTAL — the login screen is where the tour ends.
await page.evaluate(() => { window.location.hash = '#/portal'; });
await wait(4200);   // land, settle, and hold on it

await ctx.close();
await browser.close();
const file = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
console.log(`${THEME}/${VIEW}:`, file || 'NONE');
