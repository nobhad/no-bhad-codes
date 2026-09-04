/**
 * ===============================================
 * ACCESSIBILITY E2E TESTS
 * ===============================================
 * @file tests/e2e/accessibility.spec.ts
 *
 * axe-core scans of every public surface, against WCAG 2.1 A and AA.
 *
 * This is the test behind the claim on the About page. Automated scanning
 * catches roughly a third to a half of WCAG issues — it cannot judge whether
 * alt text is meaningful, whether focus order makes sense, or whether an
 * animation is actually comfortable — so passing here is a floor, not a
 * certificate. What it does guarantee is that no build ships a contrast
 * failure, an unlabelled control, a broken landmark, or a missing form label.
 *
 * To run: npm run test:e2e:a11y
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { gotoPage, introFinished, settled, transitionsSettled } from './support/site';

/**
 * WCAG 2.1 Level A and AA, and nothing else.
 *
 * Deliberately NOT axe's default tag set, which also pulls in `best-practice`
 * — opinions like "landmarks must be unique" that are not WCAG requirements.
 * The About page claims 2.1 AA, so 2.1 AA is what gets enforced.
 */
const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_21_AA);
}

/**
 * Render violations as something you can act on.
 *
 * Playwright's default diff for `toEqual([])` prints the entire axe result
 * object — several hundred lines of serialised DOM per violation, with the
 * rule id buried in it. This prints the rule, the impact, the help URL and the
 * offending selectors, which is the whole of what you need to go and fix it.
 */
function describeViolations(violations: Result[]): string {
  if (violations.length === 0) return 'none';
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => {
          // failureSummary is where axe puts the numbers — "expected contrast
          // ratio of 4.5:1, got 3.14:1" — which is the difference between
          // knowing a rule failed and knowing what to change.
          const why = (n.failureSummary || '')
            .split('\n')
            .slice(1)
            .map((line) => `        ${line.trim()}`)
            .join('\n');
          return `      - ${n.target.join(' ')}${why ? `\n${why}` : ''}`;
        })
        .join('\n');
      return `  [${v.impact}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n${nodes}`;
    })
    .join('\n\n');
}

async function expectNoViolations(page: Page, builder = scan(page)) {
  const { violations } = await builder.analyze();
  expect(describeViolations(violations), `axe found ${violations.length} violation(s)`).toBe('none');
}

/**
 * Answer the cookie banner before driving the page.
 *
 * It is fixed to the bottom and overlaps the contact form's submit button, so
 * Playwright's actionability check reports "<div id=\"consent-banner-wrapper\">
 * intercepts pointer events" and waits out the whole timeout. A visitor answers
 * it once and it goes; a test that never answers it can never reach the button
 * underneath, which is the same thing a real visitor would find if they ignored
 * it — worth knowing, and not what these tests are measuring.
 *
 * Only the interaction tests call this. The plain page scans deliberately leave
 * the banner up, because it ships on every page and has to pass on its own.
 */
async function dismissConsent(page: Page): Promise<void> {
  const decline = page.locator('[data-ref="declineBtn"]');
  if (await decline.isVisible().catch(() => false)) {
    await decline.click();
    await expect(page.locator('#consent-banner-wrapper')).toBeHidden();
  }
}

/**
 * Firefox and WebKit are skipped on purpose.
 *
 * axe-core analyses the DOM and the computed styles, so its findings barely
 * move between engines, and running five projects against ten surfaces turns a
 * ninety-second check into an eight-minute one. Desktop Chrome and Mobile
 * Chrome cover the two layouts that actually differ — the spatial map and the
 * stacked mobile view.
 */
test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'axe findings do not vary meaningfully by engine');
});

test.describe('Accessibility — main site', () => {
  const SURFACES: Array<{ name: string; hash: string; pageId: string }> = [
    { name: 'home', hash: '#/', pageId: 'intro' },
    { name: 'about', hash: '#/about', pageId: 'about' },
    { name: 'projects', hash: '#/projects', pageId: 'projects' },
    { name: 'contact', hash: '#/contact', pageId: 'contact' },
    { name: 'portal login', hash: '#/portal', pageId: 'portal-login' }
  ];

  for (const surface of SURFACES) {
    test(`${surface.name} has no WCAG 2.1 AA violations`, async ({ page }) => {
      await gotoPage(page, surface.hash, surface.pageId);
      await expectNoViolations(page);
    });
  }

  /**
   * Every case study, not a representative one. They share a template but not
   * their content, and content is where alt text, heading order and link text
   * live — the three things a template cannot get right on your behalf.
   * Slugs from public/data/portfolio.json.
   */
  const PROJECTS = [
    'nobhad-codes',
    'the-backend',
    'hedgewitch-horticulture',
    'recycle-content',
    'linktrees'
  ];

  for (const slug of PROJECTS) {
    test(`project detail (${slug}) has no WCAG 2.1 AA violations`, async ({ page }) => {
      await gotoPage(page, `#/projects/${slug}`, 'project-detail');
      await expectNoViolations(page);
    });
  }

  test('the contact form in its error state has no WCAG 2.1 AA violations', async ({ page }) => {
    await gotoPage(page, '#/contact', 'contact');

    // Submitting nothing is the shortest route to every field being invalid at
    // once: three red boxes, three aria-invalid attributes, and Arrow holding a
    // live region. None of that exists on a clean form, so a scan of the clean
    // form never sees it.
    await dismissConsent(page);
    await page.locator('.submit-button').click();
    await expect(page.locator('.contact-form .input-item.error')).toHaveCount(3);
    await settled(page, '.arrow-callout--contact');

    await expectNoViolations(page);
  });

  test('the intake terminal has no WCAG 2.1 AA violations', async ({ page }) => {
    await gotoPage(page, '#/contact', 'contact');

    await dismissConsent(page);
    await page.locator('#open-intake-link').click();
    await expect(page.locator('#intake-modal')).toHaveClass(/open/);
    // It lazy-imports its module on first open, so the boot lines arrive after
    // the modal does.
    await expect(page.locator('#intake-modal .boot-line').first()).toBeVisible();
    await settled(page, '#intake-modal');

    await expectNoViolations(page);
  });

  test('the portal login dropdown has no WCAG 2.1 AA violations', async ({ page }) => {
    // Below --mobile the header's portal button is hidden (nav-responsive.css
    // parks it at opacity 0 / visibility hidden and lets JS decide), so there
    // is no dropdown to open there — the portal lives in the menu instead.
    test.skip(
      (page.viewportSize()?.width ?? 0) < 768,
      'the header portal button is not rendered below --mobile'
    );

    await gotoPage(page, '#/', 'intro');
    await dismissConsent(page);

    await page.locator('#portal-trigger').click();
    await expect(page.locator('.portal-dropdown')).toHaveClass(/open/);
    await settled(page, '.portal-dropdown');

    await expectNoViolations(page);
  });

  test('open navigation menu has no WCAG 2.1 AA violations', async ({ page }) => {
    await gotoPage(page, '#/about', 'about');

    await page.locator('[data-menu-toggle]').first().click();
    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'open');
    // The menu opens with a STAGGERED GSAP reveal, so waiting for the first
    // link proves nothing about the fifth. Waiting for all of them is the
    // difference between measuring the palette and measuring the tween.
    await settled(page, '.menu-link');

    await expectNoViolations(page);
  });
});

test.describe('Accessibility — standalone documents', () => {
  const DOCUMENTS: Array<{ name: string; path: string; ready: string }> = [
    { name: 'design system', path: '/design-system', ready: 'main' },
    { name: '404', path: '/404.html', ready: 'main, .not-found-section' }
  ];

  for (const doc of DOCUMENTS) {
    test(`${doc.name} has no WCAG 2.1 AA violations`, async ({ page }) => {
      await page.goto(doc.path);
      await page.waitForSelector(doc.ready, { state: 'attached' });
      // The theme script fires a ~350ms colour transition on load; scanning
      // inside it measures the tween rather than the palette.
      await transitionsSettled(page);
      await expectNoViolations(page);
    });
  }
});

test.describe('Accessibility — dark theme', () => {
  test.use({ colorScheme: 'dark' });

  /**
   * The whole palette swaps here, so light-theme passes prove nothing about
   * it. This exists because darkening --color-brand-accent for the light
   * surfaces quietly took the dark one from 3.71:1 to 2.77:1 — a token shared
   * by both themes, fixed for one, broken for the other, with nothing to say
   * so. The head script reads prefers-color-scheme, so colorScheme is all it
   * takes to get there.
   */
  const DARK_SURFACES: Array<{ name: string; hash: string; pageId: string }> = [
    { name: 'home', hash: '#/', pageId: 'intro' },
    { name: 'about', hash: '#/about', pageId: 'about' },
    { name: 'contact', hash: '#/contact', pageId: 'contact' },
    { name: 'projects', hash: '#/projects', pageId: 'projects' },
    // Project detail earns a dark scan of its own: its status pills are filled
    // with the status colours, which do NOT flip between themes, so anything
    // on them that follows the theme inverts out from under itself.
    { name: 'project detail', hash: '#/projects/the-backend', pageId: 'project-detail' }
  ];

  for (const surface of DARK_SURFACES) {
    test(`${surface.name} in dark theme has no WCAG 2.1 AA violations`, async ({ page }) => {
      await gotoPage(page, surface.hash, surface.pageId);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expectNoViolations(page);
    });
  }
});

test.describe('Accessibility — reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  /**
   * The reduced-motion path is a different page, not the same page slowed down:
   * the intro is skipped outright and the map tiles are laid out without the
   * camera. It gets its own scan because none of the above exercise it.
   */
  test('home respects prefers-reduced-motion and has no violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-nav]', { state: 'attached' });
    await introFinished(page);
    await expectNoViolations(page);
  });
});
