import { chromium } from '/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext()).newPage();
await page.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded' });
const out = await page.evaluate(async () => {
  const files = ['/audio/the-broken-hearted-sparrow.mp3', '/audio/anvil-chorus.mp3', '/audio/roses-at-twilight.mp3', '/audio/tv-static.mp3'];
  const ctx = new OfflineAudioContext(1, 44100, 44100);
  const res = [];
  for (const f of files) {
    const buf = await fetch(f).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a));
    const d = buf.getChannelData(0);
    // overall RMS
    let sum = 0;
    for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
    const rms = Math.sqrt(sum / d.length);
    // crude HF energy: first difference emphasises high frequencies, so its
    // ratio to overall level says how much of the signal is hiss/crackle
    let hf = 0;
    for (let i = 1; i < d.length; i++) { const x = d[i] - d[i - 1]; hf += x * x; }
    const hfRms = Math.sqrt(hf / (d.length - 1));
    res.push({ file: f.split('/').pop(), seconds: Math.round(buf.duration), rms: rms.toFixed(4), hfRatio: (hfRms / (rms || 1e-9)).toFixed(3) });
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
