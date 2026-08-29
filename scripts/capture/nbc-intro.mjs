import { chromium } from '/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const SP = process.env.SP;
const THEME = process.argv[2] || 'light';
const SIZE = Number(process.argv[3] || 0);   // square edge, 0 = the 1440x900 default
const VIEWPORT = SIZE ? { width: SIZE, height: SIZE } : { width: 1440, height: 900 };
const dir = path.join(SP, `nbc-video-${THEME}${SIZE ? '-' + SIZE : ''}`);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  recordVideo: { dir, size: VIEWPORT }
});
// Consent already given, so the banner never renders and never has to be
// caught mid-frame. capture-portfolio.ts sets the same cookie for the same
// reason.
await ctx.addCookies([
  { name: 'tracking_consent', value: 'accepted', url: 'http://localhost:4000' }
]);
// Theme has to be in place before the first paint, or the intro plays in the
// default one and only flips afterwards — the site reads localStorage in a
// blocking head script exactly so there is no flash.
await ctx.addInitScript((tv) => {
  try { localStorage.setItem('theme', tv); } catch { /* ignore */ }
  document.documentElement.setAttribute('data-theme', tv);
}, THEME);
const page = await ctx.newPage();
// Recording began when the context was created; mark that moment so the tail
// can be cut at the paw rather than after it.
const t0 = Date.now();
const marks = {};
await page.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded' });

// In dev, Vite injects CSS through JS, so there is an unstyled beat on cold
// load. Wait for a token that only exists once variables.css has applied
// rather than guessing at a trim afterwards.
await page
  .waitForFunction(
    () => !!getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim(),
    null,
    { timeout: 15000 }
  )
  .catch(() => {});
await page.evaluate(() => document.querySelectorAll('.consent-banner').forEach((el) => el.remove()));

// 1. Intro: paw enters, clutches the card, releases, retracts.
//
// Wait on the END of it, not the middle. Measured from load: introComplete
// turns true at 2.2s, the intro-finished class lands at 4.1s, and the morph
// overlay is not actually out of the way until 4.5s. Waiting on
// introComplete flipped the card while the paw was still retracting.
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
// A beat on the finished card before anything touches it.
const introDoneAt = (Date.now() - t0) / 1000;
await page.waitForTimeout(1400);

// The card refuses clicks until the module enables interactions and finishes
// its own animation — clicking earlier is silently dropped, which is why the
// flip was missing from the first take.
await page.waitForFunction(
  async () => {
    const c = window.NBW_CONTAINER;
    const m = c && (await c.resolve('BusinessCardInteractions').catch(() => null));
    return !m || (m.isEnabled === true && m.isAnimating === false);
  },
  null,
  { timeout: 20000 }
).catch(() => {});
await page.waitForTimeout(1200);

// 2. Flip: out to the right, back to the left. The direction is decided by
//    which half of the card is clicked, not by an argument
//    (business-card-interactions.ts: clickX < cardCenterX -> 'left'), so the
//    right half turns it one way and the left half turns it back the other.
const card = await page.locator('#business-card').boundingBox();
if (card) {
  const inner = () => page.evaluate(() => getComputedStyle(document.querySelector('#business-card-inner')).transform);
  const before = await inner();
  marks.flipStart = (Date.now() - t0) / 1000;
  await page.mouse.click(card.x + card.width * 0.78, card.y + card.height / 2); // -> right
  await page.waitForTimeout(2400);
  const mid = await inner();
  await page.mouse.click(card.x + card.width * 0.22, card.y + card.height / 2); // -> left
  await page.waitForTimeout(2400);
  marks.flipEnd = (Date.now() - t0) / 1000;
  console.log('flipped right:', before !== mid, '| flipped back left:', mid !== (await inner()));
}

// 3. Exit: the paw hand-off, once the card is back on its front.
//
// It has to be a hash navigation, not an arrow key. transitionTo's slide
// mode never plays the paw — its own docstring says so — and arrow keys are
// slide mode, so ArrowRight left intro with no exit animation at all. A hash
// change takes the blur path, which is the one that calls
// playIntroExitAnimation.
await page.waitForTimeout(900);
marks.exitStart = (Date.now() - t0) / 1000;
await page.evaluate(() => { window.location.hash = '#/about'; });

// End on the paw, not after it. Watch the morph overlay come back for the
// hand-off and then go again — that is the exit finishing — and stop there,
// so the loop closes on the card being taken away rather than running on
// into the next page.
const pawVisible = () => {
  const ov = document.querySelector('#intro-morph-overlay');
  if (!ov) return false;
  const cs = getComputedStyle(ov);
  return cs.visibility !== 'hidden' && cs.opacity !== '0' && cs.display !== 'none';
};
await page.waitForFunction(pawVisible, null, { timeout: 8000 }).catch(() => {});
await page.waitForFunction(() => {
  const ov = document.querySelector('#intro-morph-overlay');
  if (!ov) return true;
  const cs = getComputedStyle(ov);
  return cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none';
}, null, { timeout: 12000 }).catch(() => {});
// The paw is done here. Everything after is the next page arriving, which is
// not what this loop is about.
const endAt = (Date.now() - t0) / 1000;
await page.waitForTimeout(250);

await ctx.close();
await browser.close();
console.log(`recorded (${THEME}):`, fs.readdirSync(dir).find((f) => f.endsWith('.webm')) || 'NONE');
marks.introDone = introDoneAt;
marks.end = endAt;
fs.writeFileSync(path.join(dir, 'endAt.txt'), String(endAt));
fs.writeFileSync(path.join(dir, 'marks.json'), JSON.stringify(marks));
console.log('paw exit completes at', endAt.toFixed(1), 's');
