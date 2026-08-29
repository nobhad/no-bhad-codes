import { chromium } from '/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const SP = 'process.env.CAPTURE_WORK || '/tmp/nbc-capture'';
const PROFILE = path.join(SP, 'hw-profile');
const DEST = '/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/public/portfolio/hedgewitch-horticulture/videos';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
};

const PUBLIC_PAGES = [
  '/', '/approach', '/offerings', '/gallery', '/native-meadows',
  '/blog', '/blog/finding-my-bark', '/resources', '/contact',
  '/admin/login'   // where the site hands off to the CMS — the door, not the room
];
const ADMIN_PAGES = [
  '/admin', '/admin/posts', '/admin/content', '/admin/gallery',
  '/admin/messages', '/admin/analytics', '/admin/settings'
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Two things fight each other when filming a scroll-driven site: the
// animations need time to play, and the camera needs to move smoothly. Big
// hops with pauses give the first and ruin the second. So the scroll runs
// continuously off requestAnimationFrame at a few pixels a frame — slow
// enough that every ScrollTrigger fires and finishes, steady enough that the
// footage never stutters.
const ARRIVAL_MS = 1800;       // entrance animations, then move off
// Recording starts when the context is created, before the first navigation
// paints, so every file opens on a blank page. Cut it off at the end.
const HEAD_TRIM_S = 2.5;
const SCROLL_PX_PER_FRAME = 3.2;
// The footer seam is a scrubbed ScrollTrigger (scrub: 1), so it keeps easing
// toward its target for about a second after the scroll stops — cut away at
// the moment the scrolling ends and the seam is caught mid-draw.
const BOTTOM_MS = 3400;
const SECTION_HOLD_MS = 3400;   // a section stops the camera until its reveal is done
const RETURN_PX_PER_FRAME = 9;  // coming back up is travel, not viewing

async function glide(page, pxPerFrame, toTop = false, pauseMs = 0, stopAtFooter = false) {
  await page
    .evaluate(
      ([px, up, pause, stopShort]) =>
        new Promise((done) => {
          // Every section gets held once, when it is CENTRED in the viewport
          // — that is where a reader would stop, and where its reveal has
          // room to finish on camera. Between holds the scroll is continuous,
          // so the footage glides rather than stutters.
          const sections = (() => {
            const all = Array.from(
              document.querySelectorAll('section, [class*="section"], [class*="Section"]')
            ).filter((el) => {
              if (el.getBoundingClientRect().height <= 160) return false;
              // A marquee is already moving on its own; stopping the page to
              // watch one just stalls the tour on text that never resolves.
              if (el.closest('[class*="marquee"], [class*="ticker"], [class*="wavy"], svg')) return false;
              // Only sections that actually animate are worth stopping for.
              // This list is the site's own lazy-init table from src/main.ts,
              // which maps these selectors to its animation modules; anything
              // else is static and gets scrolled straight past rather than
              // holding the camera on prose that has already finished moving.
              const ANIMATED = [
                '[data-hero-v2]',
                '.hero',                     // the rebus + anchored monarch
                '.hero__rebus-frame',
                '.hero__planet',
                '[data-scroll-draw-section]',
                '[data-moon-phase]',
                '[data-testimonial-carousel]',
                '[data-testimonial-group]',
                '[data-plant-carousel]',
                '[data-scroll-gallery]',
                '.gallery-listing__item',
                '.gallery-item',
                '.approach-block__wrap-shape',
                '.approach-block[data-block="3"]',
                '.approach-panel--team .approach-panel__giants',
                '.approach-path--final .approach-path__bank--rhody2',
                '.btn-starburst'
              ].join(', ');
              return el.matches(ANIMATED) || !!el.querySelector(ANIMATED);
            });
            // Outermost only. A section and its own content wrapper both match
            // the selector, and holding both stops twice on one screenful.
            return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
          })();
          const held = new WeakSet();
          let paused = false;
          // Only the two that are pure scroll-scrub with nothing to watch at
          // rest: the home hero reveal and the footer seam. The approach
          // blocks stay on the centred rule — they are the point of that page,
          // and centred is where they are meant to be read.
          const SCRUBBED_SEL = '[data-hero-v2], [data-footer-seam]';
          const isScrubbed = (el) => el.matches(SCRUBBED_SEL) || !!el.querySelector(SCRUBBED_SEL);
          const step = () => {
            if (paused) return;
            const docMax = document.body.scrollHeight - window.innerHeight;
            // Everywhere but home, the tour ends with the page's own content —
            // the CTA — rather than riding on into the footer, which is the
            // same band on every page and says nothing new about this one.
            let max = docMax;
            if (stopShort) {
              const footer = document.querySelector('footer, [data-footer-seam], [class*="footer"]');
              if (footer) {
                const top = footer.getBoundingClientRect().top + window.scrollY;
                max = Math.max(0, Math.min(docMax, top - window.innerHeight));
              }
            }
            const y = window.scrollY;
            if (up) {
              if (y <= 0) return done();
              window.scrollTo(0, Math.max(0, y - px));
              return requestAnimationFrame(step);
            }
            if (max <= 8 || y >= max - 1) return done();
            if (pause > 0) {
              const vh = window.innerHeight;
              const fresh = sections.find((el) => {
                if (held.has(el)) return false;
                const r = el.getBoundingClientRect();
                const centre = r.top + r.height / 2;

                // Scrubbed animations are driven BY the scroll, not by time:
                // the vine draw is trigger top-top -> bottom-bottom with
                // scrub:1, so it only advances while the page is moving.
                // Stopping in the middle of one freezes it half-drawn — the
                // pollinator paths never finished for exactly this reason.
                // So ride straight through the range and hold once it is
                // spent, which is also long enough for scrub:1's lerp and the
                // 1.4s vine release to settle.
                const scrubbed = isScrubbed(el);
                if (scrubbed) return r.bottom <= vh + 24 && r.bottom > 0;

                // Everything else plays on arrival, so hold it dead centre —
                // a loose tolerance fires at the first frame that qualifies,
                // which parks the block near the top of the screen instead of
                // in the middle of it.
                if (r.height > vh * 1.6) return r.top <= 8 && r.top > -vh * 0.6;
                return Math.abs(centre - vh / 2) < 45;
              });
              if (fresh) {
                held.add(fresh);
                paused = true;
                // A scrubbed section finished as it was ridden through, so it
                // only needs scrub:1's lerp to settle — holding it for a full
                // viewing beat reads as the video stalling after the hero.
                const ms = isScrubbed(fresh) ? Math.min(pause, 1400) : pause;
                setTimeout(() => {
                  paused = false;
                  requestAnimationFrame(step);
                }, ms);
                return;
              }
            }
            window.scrollTo(0, Math.min(max, y + px));
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }),
      [pxPerFrame, toTop, pauseMs, stopAtFooter]
    )
    .catch(() => {});
}

// The gallery's whole point is the lightbox, so open it on camera: a couple
// of frames on the grid, then an item, then paging through with the arrows.
async function openLightbox(page) {
  const item = page.locator('.gallery-item').first();
  if ((await item.count()) === 0) return;
  await item.scrollIntoViewIfNeeded().catch(() => {});
  await wait(900);
  await item.click({ timeout: 5000 }).catch(() => {});
  await wait(2200);
  for (let i = 0; i < 2; i++) {
    await page.locator('.gallery-lightbox__nav--next').first().click({ timeout: 3000 }).catch(() => {});
    await wait(2000);
  }
  await page.locator('.gallery-lightbox__close').first().click({ timeout: 3000 }).catch(() => {});
  await wait(1200);
}

async function tour(page, path) {
  const isHome = path === '/';
  await wait(ARRIVAL_MS);
  await glide(page, SCROLL_PX_PER_FRAME, false, SECTION_HOLD_MS, !isHome);
  // Only home rides into the footer, so only home waits on the seam.
  await wait(isHome ? BOTTOM_MS : 1600);
  if (path === '/gallery') await openLightbox(page);
}

async function capture(name, viewportName, pages, signedOut = false) {
  const viewport = VIEWPORTS[viewportName];
  const dir = path.join(SP, 'video', `${name}-${viewportName}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  let ctx;
  if (signedOut) {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    ctx = await browser.newContext({ viewport, recordVideo: { dir, size: viewport } });
    ctx.__browser = browser;
  } else {
    ctx = await chromium.launchPersistentContext(PROFILE, {
      headless: true, channel: 'chrome', viewport, recordVideo: { dir, size: viewport }
    });
  }
  const page = ctx.pages()[0] || (await ctx.newPage());

  const gated = [];
  for (const p of pages) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await wait(500);
    if (p.startsWith('/admin') && page.url().includes('/admin/login')) gated.push(p);
    await tour(page, p);
  }
  await ctx.close();
  if (ctx.__browser) await ctx.__browser.close();

  const file = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
  if (!file) { console.log(`FAILED ${name}-${viewportName}`); return; }
  fs.mkdirSync(DEST, { recursive: true });
  const out = path.join(DEST, `${name}-${viewportName}.webm`);
  fs.copyFileSync(path.join(dir, file), out);
  console.log(`${(name + '-' + viewportName + '.webm').padEnd(24)} ${String(Math.round(fs.statSync(out).size / 1024)).padStart(5)}KB  ${pages.length} pages${gated.length ? `  ** LOGIN GATE on ${gated.join(', ')} **` : ''}`);
}

const SETS = {
  site: PUBLIC_PAGES,
  admin: ADMIN_PAGES,
  full: [...PUBLIC_PAGES, ...ADMIN_PAGES]
};
const only = process.argv[2];
const onlyViewport = process.argv[3];
for (const name of only ? [only] : ['site', 'admin', 'full']) {
  for (const v of onlyViewport ? [onlyViewport] : ['desktop', 'mobile']) {
    await capture(name, v, SETS[name], name === 'site');
  }
}
