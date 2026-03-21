/**
 * Portfolio Screenshot & Video Script
 * Captures public pages in light/dark mode at desktop/mobile sizes.
 * Also records video walkthroughs of the site.
 * No browser chrome — clean viewport-only captures.
 *
 * Usage: npx tsx scripts/take-screenshots.ts
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:4000';
const OUTPUT_DIR = path.resolve(import.meta.dirname, '..', 'screenshots');
const VIDEO_DIR = path.join(OUTPUT_DIR, 'videos');
const FULL_PAGE = true;

const ANIMATION_WAIT_MS = 3000;
const PAGE_LOAD_WAIT_MS = 2000;
const NAV_WAIT_MS = 1000;
const VIDEO_PAGE_PAUSE_MS = 2500;
const VIDEO_TRANSITION_MS = 1500;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const THEMES = [
  { name: 'light', value: 'light' },
  { name: 'dark', value: 'dark' },
];

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/#/about' },
  { name: 'projects', path: '/#/projects' },
  { name: 'project-nobhad-codes', path: '/#/projects/nobhad-codes' },
  { name: 'project-the-backend', path: '/#/projects/the-backend' },
  { name: 'project-recycle-content', path: '/#/projects/recycle-content' },
  { name: 'project-linktrees', path: '/#/projects/linktrees' },
  { name: 'contact', path: '/#/contact' },
  { name: 'admin-login', path: '/admin/login' },
  { name: 'portal-login', path: '/portal/login' },
];

// Pages for the video walkthrough (subset, in viewing order)
const VIDEO_WALKTHROUGH = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/#/about' },
  { name: 'projects', path: '/#/projects' },
  { name: 'project-nobhad-codes', path: '/#/projects/nobhad-codes' },
  { name: 'project-the-backend', path: '/#/projects/the-backend' },
  { name: 'projects', path: '/#/projects' },
  { name: 'contact', path: '/#/contact' },
  { name: 'home', path: '/' },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setTheme(page: puppeteer.Page, themeValue: string) {
  return page.evaluate((tv: string) => {
    localStorage.setItem('theme', tv);
    document.documentElement.setAttribute('data-theme', tv);
  }, themeValue);
}

// ============================================
// SCREENSHOTS
// ============================================

async function takeScreenshots() {
  console.log('=== SCREENSHOTS ===\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const label = `${viewport.name} / ${theme.name}`;
      console.log(`--- ${label} ---`);

      await page.setViewport({ width: viewport.width, height: viewport.height });

      for (const pageConfig of PAGES) {
        const url = `${BASE_URL}${pageConfig.path}`;
        const filename = `${pageConfig.name}-${theme.name}-${viewport.name}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);

        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
          await setTheme(page, theme.value);
          await wait(PAGE_LOAD_WAIT_MS);

          if (pageConfig.name === 'home') {
            try {
              await page.evaluate(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
              });
            } catch { /* no skip needed */ }
            await wait(ANIMATION_WAIT_MS);
          }

          if (pageConfig.path.includes('#/')) {
            await wait(ANIMATION_WAIT_MS);
          }

          await page.screenshot({ path: filepath, fullPage: FULL_PAGE, type: 'png' });
          console.log(`  ${filename}`);

          // Capture nav-open on home page
          if (pageConfig.name === 'home') {
            const navFilename = `nav-open-${theme.name}-${viewport.name}.png`;
            const navFilepath = path.join(OUTPUT_DIR, navFilename);
            try {
              await page.click('[data-menu-toggle]');
              await wait(NAV_WAIT_MS);
              await page.screenshot({ path: navFilepath, fullPage: false, type: 'png' });
              console.log(`  ${navFilename}`);
              await page.click('[data-menu-toggle]');
              await wait(500);
            } catch {
              console.error(`  Failed: nav-open`);
            }
          }
        } catch (err) {
          console.error(`  Failed: ${pageConfig.name} - ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }

  await browser.close();
  console.log(`\nScreenshots saved to: ${OUTPUT_DIR}\n`);
}

// ============================================
// VIDEO RECORDING
// ============================================

async function recordVideos() {
  console.log('=== VIDEO WALKTHROUGHS ===\n');

  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const label = `${viewport.name}-${theme.name}`;
      const videoPath = path.join(VIDEO_DIR, `walkthrough-${label}.webm`);
      console.log(`Recording: ${label}...`);

      const page = await browser.newPage();
      await page.setViewport({ width: viewport.width, height: viewport.height });

      const recorder = await page.screencast({ path: videoPath });

      // Navigate to home first and set theme
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: 15000 });
      await setTheme(page, theme.value);
      await wait(PAGE_LOAD_WAIT_MS);

      // Skip intro
      try {
        await page.evaluate(() => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
      } catch { /* fine */ }
      await wait(ANIMATION_WAIT_MS);

      // Show nav menu open/close
      try {
        await page.click('[data-menu-toggle]');
        await wait(VIDEO_PAGE_PAUSE_MS);
        await page.click('[data-menu-toggle]');
        await wait(VIDEO_TRANSITION_MS);
      } catch { /* nav toggle failed */ }

      // Walk through pages
      for (const pageConfig of VIDEO_WALKTHROUGH.slice(1)) {
        const url = `${BASE_URL}${pageConfig.path}`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        await setTheme(page, theme.value);
        await wait(VIDEO_TRANSITION_MS);

        // Scroll down slowly on content-heavy pages
        if (['about', 'project-nobhad-codes', 'project-the-backend'].includes(pageConfig.name)) {
          await page.evaluate(async () => {
            const scrollStep = 200;
            const scrollDelay = 100;
            const maxScroll = document.body.scrollHeight - window.innerHeight;
            for (let pos = 0; pos < maxScroll; pos += scrollStep) {
              window.scrollTo(0, pos);
              await new Promise((r) => setTimeout(r, scrollDelay));
            }
            // Scroll back to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await new Promise((r) => setTimeout(r, 500));
          });
        }

        await wait(VIDEO_PAGE_PAUSE_MS);
      }

      // Pause on final home page
      await wait(VIDEO_PAGE_PAUSE_MS);

      await recorder.stop();
      await page.close();

      console.log(`  Saved: walkthrough-${label}.webm`);
    }
  }

  await browser.close();
  console.log(`\nVideos saved to: ${VIDEO_DIR}\n`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  await takeScreenshots();
  await recordVideos();
  console.log('Done!');
}

main().catch(console.error);
