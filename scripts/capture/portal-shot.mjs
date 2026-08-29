import { chromium } from '/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/node_modules/playwright/index.mjs';
const SP = process.env.SP;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: 'tracking_consent', value: 'accepted', url: 'http://localhost:4000' }]);
  await ctx.addInitScript((tv) => {
    try { localStorage.setItem('theme', tv); } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme', tv);
  }, theme);
  const page = await ctx.newPage();
  await page.goto('http://localhost:4000/#/portal', { waitUntil: 'load' });
  await page.waitForFunction(
    () => !!getComputedStyle(document.documentElement).getPropertyValue('--font-size-base').trim(),
    null, { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(6000);   // intro hand-off, then the portal settles
  await page.evaluate(() => document.querySelectorAll('.consent-banner').forEach((el) => el.remove()));
  await page.waitForTimeout(600);
  const state = await page.evaluate(() => ({
    hash: location.hash,
    heading: document.querySelector('#portal-login h1, .portal-login h1, h1')?.textContent?.trim().slice(0, 30),
    hasPassword: !!document.querySelector('input[type=password]'),
    active: document.querySelector('main')?.getAttribute('data-active-page')
  }));
  await page.screenshot({ path: `${SP}/portal-${theme}.png` });
  console.log(theme.padEnd(6), JSON.stringify(state));
  await ctx.close();
}
await browser.close();
