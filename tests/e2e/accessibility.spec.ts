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

  test('project detail has no WCAG 2.1 AA violations', async ({ page }) => {
    await gotoPage(page, '#/projects/hedgewitch-horticulture', 'project-detail');
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
