/**
 * Portfolio Screenshot & Video Script
 * Captures public pages in light/dark mode at desktop/mobile sizes.
 * Also records video walkthroughs of the site.
 * No browser chrome — clean viewport-only captures.
 *
 * Usage:
 *   npx tsx scripts/capture-portfolio.ts                  (defaults to --all)
 *   npx tsx scripts/capture-portfolio.ts --screenshots    (screenshots only)
 *   npx tsx scripts/capture-portfolio.ts --video          (videos only)
 *   npx tsx scripts/capture-portfolio.ts --all            (both)
 */

const MODE_SCREENSHOTS = '--screenshots';
const MODE_VIDEO = '--video';
const MODE_ALL = '--all';
const VALID_MODES = [MODE_SCREENSHOTS, MODE_VIDEO, MODE_ALL] as const;
type Mode = typeof VALID_MODES[number];

import 'dotenv/config';
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
const LOGIN_NAV_TIMEOUT_MS = 15000;
const POST_LOGIN_SETTLE_MS = 2500;
const DROPDOWN_OPEN_DELAY_MS = 1500;

// Unified login lives in the main-site portal dropdown. Server detects
// admin vs client by email and sets role-aware auth cookies.
const LOGIN_PATH = '/#/portal';
const LOGIN_TRIGGER_SELECTOR = '#portal-trigger';
const LOGIN_EMAIL_SELECTOR = '#portal-email';
const LOGIN_PASSWORD_SELECTOR = '#portal-password';
const LOGIN_SUBMIT_SELECTOR = '#portal-password-form button[type="submit"]';
const LOGIN_API_PATH = '/api/auth/portal-login';

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

// Authenticated pages — captured only when env credentials are set.
// Both roles use /dashboard#/<tab>; SPA renders role-specific content.
const AUTH_ADMIN_PAGES = [
  { name: 'admin-dashboard', path: '/dashboard#/dashboard' },
  { name: 'admin-work', path: '/dashboard#/work' },
  { name: 'admin-crm', path: '/dashboard#/crm' },
  { name: 'admin-analytics', path: '/dashboard#/analytics' },
];

const AUTH_CLIENT_PAGES = [
  { name: 'portal-dashboard', path: '/dashboard#/dashboard' },
  { name: 'portal-messages', path: '/dashboard#/messages' },
  { name: 'portal-invoices', path: '/dashboard#/invoices' },
  { name: 'portal-files', path: '/dashboard#/files' },
  { name: 'portal-projects', path: '/dashboard#/projects' },
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
// AUTH HELPERS
// ============================================

function getAdminCredentials(): { email: string; password: string } | null {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('  Skipping admin auth: ADMIN_EMAIL or ADMIN_PASSWORD not set in .env');
    return null;
  }
  return { email, password };
}

function getClientCredentials(): { email: string; password: string } | null {
  const email = process.env.PORTAL_EMAIL;
  const password = process.env.PORTAL_PASSWORD;
  if (!email || !password) {
    console.warn('  Skipping client auth: PORTAL_EMAIL or PORTAL_PASSWORD not set in .env');
    return null;
  }
  return { email, password };
}

async function loginAs(page: puppeteer.Page, email: string, password: string) {
  await page.goto(`${BASE_URL}${LOGIN_PATH}`, {
    waitUntil: 'networkidle2',
    timeout: LOGIN_NAV_TIMEOUT_MS,
  });

  await page.waitForSelector(LOGIN_TRIGGER_SELECTOR, { timeout: LOGIN_NAV_TIMEOUT_MS });
  await page.click(LOGIN_TRIGGER_SELECTOR);
  await wait(DROPDOWN_OPEN_DELAY_MS);

  await page.waitForSelector(LOGIN_EMAIL_SELECTOR, { timeout: LOGIN_NAV_TIMEOUT_MS });
  await page.click(LOGIN_EMAIL_SELECTOR);
  await page.type(LOGIN_EMAIL_SELECTOR, email);
  await page.click(LOGIN_PASSWORD_SELECTOR);
  await page.type(LOGIN_PASSWORD_SELECTOR, password);

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes(LOGIN_API_PATH) && res.request().method() === 'POST',
    { timeout: LOGIN_NAV_TIMEOUT_MS },
  );
  await page.click(LOGIN_SUBMIT_SELECTOR);
  const response = await responsePromise;
  if (!response.ok()) {
    const body = await response.text().catch(() => '');
    throw new Error(`Login failed (${response.status()}): ${body.slice(0, 200)}`);
  }
  await wait(POST_LOGIN_SETTLE_MS);
}

async function captureAuthenticatedPages(
  page: puppeteer.Page,
  pages: typeof AUTH_ADMIN_PAGES,
  themeName: string,
  themeValue: string,
  viewportName: string,
) {
  for (const pageConfig of pages) {
    const filename = `${pageConfig.name}-${themeName}-${viewportName}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    try {
      await page.goto(`${BASE_URL}${pageConfig.path}`, {
        waitUntil: 'networkidle2',
        timeout: LOGIN_NAV_TIMEOUT_MS,
      });
      await setTheme(page, themeValue);
      await wait(ANIMATION_WAIT_MS);
      await page.screenshot({ path: filepath, fullPage: FULL_PAGE, type: 'png' });
      console.log(`  ${filename}`);
    } catch (err) {
      console.error(`  Failed: ${pageConfig.name} - ${err instanceof Error ? err.message : err}`);
    }
  }
}

// ============================================
// AUTHENTICATED SCREENSHOTS
// ============================================

// Login always happens at desktop viewport — the portal-trigger button
// is hidden behind a hamburger on mobile and not clickable.
const LOGIN_VIEWPORT = VIEWPORTS.find((v) => v.name === 'desktop') ?? VIEWPORTS[0];

async function captureAuthenticatedScreenshotsForRole(
  browser: puppeteer.Browser,
  creds: { email: string; password: string },
  pages: typeof AUTH_ADMIN_PAGES,
  roleLabel: string,
) {
  const context = await browser.createBrowserContext();
  const loginPage = await context.newPage();
  await loginPage.setViewport({ width: LOGIN_VIEWPORT.width, height: LOGIN_VIEWPORT.height });

  try {
    await loginAs(loginPage, creds.email, creds.password);
  } catch (err) {
    console.error(`  ${roleLabel} login failed: ${err instanceof Error ? err.message : err}`);
    await context.close();
    return;
  }
  await loginPage.close();

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      console.log(`--- ${roleLabel}: ${viewport.name} / ${theme.name} ---`);
      const page = await context.newPage();
      await page.setViewport({ width: viewport.width, height: viewport.height });
      await captureAuthenticatedPages(page, pages, theme.name, theme.value, viewport.name);
      await page.close();
    }
  }

  await context.close();
}

async function takeAuthenticatedScreenshots() {
  const adminCreds = getAdminCredentials();
  const clientCreds = getClientCredentials();
  if (!adminCreds && !clientCreds) return;

  console.log('=== AUTHENTICATED SCREENSHOTS ===\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  if (adminCreds) {
    await captureAuthenticatedScreenshotsForRole(browser, adminCreds, AUTH_ADMIN_PAGES, 'admin');
  }
  if (clientCreds) {
    await captureAuthenticatedScreenshotsForRole(browser, clientCreds, AUTH_CLIENT_PAGES, 'client');
  }

  await browser.close();
  console.log(`\nAuthenticated screenshots saved to: ${OUTPUT_DIR}\n`);
}

// ============================================
// AUTHENTICATED VIDEOS
// ============================================

async function recordAuthenticatedWalkthrough(
  page: puppeteer.Page,
  pages: typeof AUTH_ADMIN_PAGES,
  themeValue: string,
) {
  for (const pageConfig of pages) {
    try {
      await page.goto(`${BASE_URL}${pageConfig.path}`, {
        waitUntil: 'networkidle2',
        timeout: LOGIN_NAV_TIMEOUT_MS,
      });
      await setTheme(page, themeValue);
      await wait(VIDEO_TRANSITION_MS);

      // Slow scroll to show content
      await page.evaluate(async () => {
        const scrollStep = 200;
        const scrollDelay = 100;
        const maxScroll = document.body.scrollHeight - window.innerHeight;
        for (let pos = 0; pos < maxScroll; pos += scrollStep) {
          window.scrollTo(0, pos);
          await new Promise((r) => setTimeout(r, scrollDelay));
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await new Promise((r) => setTimeout(r, 500));
      });

      await wait(VIDEO_PAGE_PAUSE_MS);
    } catch (err) {
      console.error(`  Failed: ${pageConfig.name} - ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function recordAuthenticatedVideosForRole(
  browser: puppeteer.Browser,
  creds: { email: string; password: string },
  pages: typeof AUTH_ADMIN_PAGES,
  roleLabel: string,
  fileSlug: string,
) {
  const context = await browser.createBrowserContext();
  const loginPage = await context.newPage();
  await loginPage.setViewport({ width: LOGIN_VIEWPORT.width, height: LOGIN_VIEWPORT.height });

  try {
    await loginAs(loginPage, creds.email, creds.password);
  } catch (err) {
    console.error(`  ${roleLabel} login failed: ${err instanceof Error ? err.message : err}`);
    await context.close();
    return;
  }
  await loginPage.close();

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const label = `${viewport.name}-${theme.name}`;
      const videoPath = path.join(VIDEO_DIR, `walkthrough-${fileSlug}-${label}.webm`);
      console.log(`Recording ${roleLabel}: ${label}...`);
      const page = await context.newPage();
      await page.setViewport({ width: viewport.width, height: viewport.height });
      try {
        const recorder = await page.screencast({ path: videoPath });
        await recordAuthenticatedWalkthrough(page, pages, theme.value);
        await recorder.stop();
        console.log(`  Saved: walkthrough-${fileSlug}-${label}.webm`);
      } catch (err) {
        console.error(`  ${roleLabel} video failed: ${err instanceof Error ? err.message : err}`);
      }
      await page.close();
    }
  }

  await context.close();
}

async function recordAuthenticatedVideos() {
  const adminCreds = getAdminCredentials();
  const clientCreds = getClientCredentials();
  if (!adminCreds && !clientCreds) return;

  console.log('=== AUTHENTICATED VIDEO WALKTHROUGHS ===\n');

  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  if (adminCreds) {
    await recordAuthenticatedVideosForRole(browser, adminCreds, AUTH_ADMIN_PAGES, 'admin', 'admin');
  }
  if (clientCreds) {
    await recordAuthenticatedVideosForRole(browser, clientCreds, AUTH_CLIENT_PAGES, 'client', 'portal');
  }

  await browser.close();
  console.log(`\nAuthenticated videos saved to: ${VIDEO_DIR}\n`);
}

// ============================================
// MAIN
// ============================================

function parseMode(argv: string[]): Mode {
  const flag = argv.find((arg) => VALID_MODES.includes(arg as Mode));
  if (!flag) return MODE_ALL;
  return flag as Mode;
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  console.log(`Mode: ${mode}\n`);

  if (mode === MODE_SCREENSHOTS || mode === MODE_ALL) {
    await takeScreenshots();
    await takeAuthenticatedScreenshots();
  }
  if (mode === MODE_VIDEO || mode === MODE_ALL) {
    await recordVideos();
    await recordAuthenticatedVideos();
  }

  console.log('Done!');
}

main().catch(console.error);
