/**
 * ===============================================
 * NAVIGATION E2E TESTS
 * ===============================================
 * @file tests/e2e/navigation.spec.ts
 *
 * End-to-end tests for navigation functionality.
 */

import { test, expect } from '@playwright/test';
import { settledOn } from './support/site';

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
    //
    // Navigate by hash, NOT page.goto(). goto() reloads the document, which
    // restarts the ~4.5s intro that beforeEach already waited out — twice over,
    // that alone exceeded the 30s test budget and this failed as a timeout in
    // settledOn's intro wait rather than on anything about back/forward. Hash
    // navigation is also what the app actually does when a user clicks a link.
    // Navigate the way a visitor does — through the menu. Two earlier attempts
    // were wrong in different ways: page.goto() reloads the document and
    // restarts the ~4.5s intro (two of those blew the 30s test budget), and
    // setting location.hash directly moves the URL without driving the map
    // camera, so the tile never actually panned into view. Clicking the link
    // exercises the real router and leaves the history entries this test needs.
    const openMenuAndClick = async (href: string) => {
      await page.locator('[data-menu-toggle]').first().click();
      await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'open');
      await page.locator(`.menu-link[href="${href}"]`).click();
    };

    // Assert on the app's OWN statement of which page is showing, not on
    // geometry. These sections are map tiles: the inactive ones are laid out
    // off-screen and hidden, so `toBeInViewport` reports ratio 0 for anything
    // mid-transition and is a race even when the right page has landed.
    // page-transition.ts publishes data-active-page on the container, which is
    // exactly "the page currently on screen" with no timing ambiguity.
    const activePage = page.locator('[data-active-page]');

    await openMenuAndClick('#/about');
    await settledOn(page, 'about');
    await expect(activePage).toHaveAttribute('data-active-page', 'about');

    await openMenuAndClick('#/contact');
    await settledOn(page, 'contact');
    await expect(activePage).toHaveAttribute('data-active-page', 'contact');

    await page.goBack();
    await expect(page).toHaveURL(/#\/about$/);
    await settledOn(page, 'about');
    await expect(activePage).toHaveAttribute('data-active-page', 'about');

    await page.goForward();
    await expect(page).toHaveURL(/#\/contact$/);
    await settledOn(page, 'contact');
    await expect(activePage).toHaveAttribute('data-active-page', 'contact');
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Open menu with keyboard
    await page.focus('[data-menu-toggle]');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-nav]')).toHaveAttribute('data-nav', 'open');

    // Focus a menu link outright, then activate it.
    //
    // This used to Tab once and press ArrowDown twice, on the assumption that
    // the menu implements roving arrow-key navigation. It does not — the links
    // are plain anchors — so ArrowDown moved nothing, focus was still wherever
    // one Tab had left it, and Enter activated something that was not a link.
    // The URL never changed and the failure looked like "keyboard nav is
    // broken" when the test was simply pressing the wrong keys.
    // A link to somewhere ELSE. The first .menu-link is whatever page you are
    // already on, which carries aria-current="page" and pointer-events:none
    // (nav-base.css) — it is deliberately not actionable, so focusing it and
    // pressing Enter navigates nowhere.
    const firstLink = page.locator('.menu-link:not(.active)').first();
    // The menu opens with a GSAP reveal; the links are in the DOM before they
    // are actually shown, and an element that is not yet visible cannot take
    // focus. Waiting for the reveal is the difference between testing keyboard
    // activation and testing a race.
    await expect(firstLink).toBeVisible();
    await firstLink.focus();
    await expect(firstLink).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/#\//);
  });

  test('should show active menu item', async ({ page }) => {
    await page.goto('/#/about');
    await page.click('[data-menu-toggle]');
    await expect(page.locator('a[href="#/about"]')).toHaveClass(/active/);
  });
});
