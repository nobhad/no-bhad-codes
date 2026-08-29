import { chromium } from '/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/node_modules/playwright/index.mjs';
const SP = process.env.SP;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'load' });
await page.waitForTimeout(5000);

// The hero reveal is scrubbed by scroll position, so the animation is a
// function of scrollY: step through it and each stop is one frame.
const START = 120, END = 900, FRAMES = 26;
for (let i = 0; i < FRAMES; i++) {
  const y = Math.round(START + ((END - START) * i) / (FRAMES - 1));
  await page.evaluate((t) => window.scrollTo(0, t), y);
  await page.waitForTimeout(260);
  await page.screenshot({ path: `${SP}/frames/f${String(i).padStart(3, '0')}.png` });
}
// Hold on the finished state so the loop rests there instead of snapping back.
for (let i = FRAMES; i < FRAMES + 10; i++) {
  await page.screenshot({ path: `${SP}/frames/f${String(i).padStart(3, '0')}.png` });
}
console.log('frames:', FRAMES + 10);
await browser.close();
