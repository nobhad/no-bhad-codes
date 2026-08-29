import { chromium } from '/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/node_modules/playwright/index.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Tap the output: everything the page plays passes through an analyser on its
// way to the speakers, so we can read actual amplitude rather than the gain
// values the code asks for.
await ctx.addInitScript(() => {
  const origConnect = AudioNode.prototype.connect;
  window.__rms = [];
  AudioNode.prototype.connect = function (dest, ...rest) {
    try {
      if (dest === this.context.destination && !window.__tap) {
        const an = this.context.createAnalyser();
        an.fftSize = 2048;
        window.__tap = an;
        origConnect.call(an, dest);
        const buf = new Float32Array(an.fftSize);
        setInterval(() => {
          an.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          window.__rms.push({ t: Math.round(performance.now()), rms: Math.sqrt(sum / buf.length) });
        }, 50);
        return origConnect.call(this, an, ...rest);
      }
    } catch { /* fall through */ }
    return origConnect.call(this, dest, ...rest);
  };
});
const page = await ctx.newPage();
await page.goto('http://localhost:4000/#/projects', { waitUntil: 'load' });
await sleep(4000);
await page.mouse.click(700, 450);
await sleep(1500);

const window_ = async (label, ms) => {
  await page.evaluate(() => { window.__rms = []; });
  await sleep(ms);
  const r = await page.evaluate(() => {
    const v = window.__rms.map((x) => x.rms);
    if (!v.length) return null;
    return { peak: Math.max(...v).toFixed(4), mean: (v.reduce((a, b) => a + b, 0) / v.length).toFixed(4), samples: v.length };
  });
  console.log(label.padEnd(34), JSON.stringify(r));
};

await window_('guide, before tuning in', 2500);
await page.evaluate(async () => { const pj = await window.NBW_CONTAINER.resolve('ProjectsModule'); void pj.playTuneInSequence('nobhad-codes'); });
await window_('tune-in (crackle + start)', 3000);
await sleep(6000);
await window_('channel music, settled', 4000);
await browser.close();
