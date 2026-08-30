/**
 * ===============================================
 * NAVIGATION E2E TESTS
 * ===============================================
 * @file tests/e2e/navigation.spec.ts
 *
 * End-to-end tests for navigation functionality.
 */

import { test, expect } from '@playwright/test';

/**
 * Wait until the camera has actually landed on `pageId` and stopped moving.
 *
 * A bare `goto('/#/about')` may reload the document, and on a fresh document
 * the intro runs for about four and a half seconds before the router will act
 * on anything — longer than an assertion's default window. Asking the app when
 * it has arrived beats guessing how long it takes.
 */
async function settledOn(page: import('@playwright/test').Page, pageId: string) {
  await page.waitForFunction(
    () => document.documentElement.classList.contains('intro-finished'),
    null,
    { timeout: 25000 }
  );
  await page.waitForFunction(
    async (id) => {
      const container = (
        window as unknown as { NBW_CONTAINER?: { resolve(n: string): Promise<unknown> } }
      ).NBW_CONTAINER;
      if (!container) return false;
      const pt = (await container.resolve('PageTransitionModule')) as {
        currentPageId: string;
        isTransitioning: boolean;
      } | null;
      return !!pt && pt.currentPageId === id && pt.isTransitioning === false;
    },
    pageId,
    { timeout: 25000 }
  );
}

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app initialization. 'attached', not the default 'visible': the
    // menu starts closed, so [data-nav] is in the DOM at display:none until
    // something opens it, and waiting for it to be visible times out before
    // any of these tests get to run.
    await page.waitForSelector('[data-nav]', { state: 'attached' });
    // And wait for the intro to hand over. The paw runs for about four and a
    // half seconds on a cold load, during which the site deliberately holds
    // navigation; starting a test inside that window races the animation
    // rather than testing anything.
    await page.waitForFunction(
      () => document.documentElement.classList.contains('intro-finished'),
      null,
      { timeout: 20000 }
    );
  });

  test('should open and close menu', async ({ page }) => {
    // Open menu
    await page.click('[data-menu-toggle]');
    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'open');

    // Menu should be visible
    await expect(page.locator('.menu')).toBeVisible();
    await expect(page.locator('.menu-link')).toHaveCount(5);

    // Close by clicking the overlay at its left edge, halfway down. It fills
    // the screen but is not the top element everywhere: the open menu covers
    // the middle, the header covers the top, and the footer band covers the
    // bottom. Left-middle is the reliably clear strip.
    await page.click('.overlay', { position: { x: 12, y: 360 } });
    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'closed');
  });

  test('should navigate between sections', async ({ page }) => {
    // Routes are hashes with a path — '#/about', not '#about'. The menu moves
    // the camera between map tiles rather than scrolling one page.
    await page.click('[data-menu-toggle]');
    await page.click('a[href="#/about"]');
    await expect(page).toHaveURL(/#\/about$/);
    await expect(page.locator('.about-section')).toBeInViewport();

    await page.click('[data-menu-toggle]');
    await page.click('a[href="#/contact"]');
    await expect(page).toHaveURL(/#\/contact$/);
    await expect(page.locator('.contact-section')).toBeInViewport();
  });

  test('should close menu on escape key', async ({ page }) => {
    // Open menu
    await page.click('[data-menu-toggle]');
    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'open');

    // Press escape
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'closed');
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Canonical routes: the map writes '#/about' back into the URL as the
    // camera lands, so asserting the legacy '#about' form fights the app's own
    // canonicalisation and leaves history entries that do not match.
    await page.goto('/#/about');
    await settledOn(page, 'about');
    await expect(page.locator('.about-section')).toBeInViewport();

    await page.goto('/#/contact');
    await settledOn(page, 'contact');
    await expect(page.locator('.contact-section')).toBeInViewport();

    await page.goBack();
    await expect(page).toHaveURL(/#\/about$/);
    await settledOn(page, 'about');
    await expect(page.locator('.about-section')).toBeInViewport();

    await page.goForward();
    await expect(page).toHaveURL(/#\/contact$/);
    await settledOn(page, 'contact');
    await expect(page.locator('.contact-section')).toBeInViewport();
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Open menu with keyboard
    await page.focus('[data-menu-toggle]');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'open');

    // Navigate menu items with arrow keys
    await page.keyboard.press('Tab'); // Focus first menu item
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // Activate whichever link focus landed on; the assertion is that keyboard
    // activation navigates at all, not which entry it reached.
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/#\//);
  });

  test('should show active menu item', async ({ page }) => {
    await page.goto('/#/about');
    await page.click('[data-menu-toggle]');
    await expect(page.locator('a[href="#/about"]')).toHaveClass(/active/);
  });
});
