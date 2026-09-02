/**
 * ===============================================
 * CONTACT FORM E2E TESTS
 * ===============================================
 * @file tests/e2e/contact-form.spec.ts
 *
 * Covers the contact form and Arrow, the mascot who carries every piece of
 * feedback it gives — validation, send failures and the sent confirmation.
 *
 * The form has no plain-text error node any more: `.form-message` and
 * `.form-error-tooltip` were removed when Arrow took over, so asserting on
 * Arrow's blurb IS asserting on the form's error handling.
 *
 * Viewport matters. Arrow parks in the gutter beside the form on desktop and
 * waits to be dismissed; below 768px there is no gutter, so she is transient
 * and dips away on a timer. The mobile projects in playwright.config.ts
 * (Pixel 5, iPhone 12) run the second branch, so anything viewport-specific is
 * gated on the measured width rather than assumed.
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

/** Matches the --mobile breakpoint the theme and contact-form.ts both use. */
const MOBILE_MAX_WIDTH = 767;

/** Arrow auto-dips on mobile after TIMING.ARROW_MOBILE_AUTO_HIDE (6s). */
const MOBILE_AUTO_HIDE_MS = 6000;

const arrow = (page: Page): Locator => page.locator('[data-callout-id="contact-feedback"]');

/**
 * Wait for Arrow's entrance to finish, not merely for her to exist.
 *
 * She slides up and fades in, and Playwright counts opacity:0 as visible — so
 * `toBeVisible()` resolves on the first frame, when she is still ~389px below
 * her resting position and off the bottom of a 720px viewport. Anything that
 * measures her then is reading a frame of the animation: elementFromPoint at
 * her close button returned null because the point was outside the viewport.
 * She settles in ~200ms; this waits for three consecutive frames with a still
 * box and full opacity.
 */
async function arrowSettled(page: Page): Promise<void> {
  await arrow(page).evaluate(
    (el) =>
      new Promise<void>((resolve, reject) => {
        const deadline = performance.now() + 5000;
        let last = Number.NaN;
        let stable = 0;
        const tick = (): void => {
          const top = el.getBoundingClientRect().top;
          const opaque = parseFloat(getComputedStyle(el).opacity) > 0.99;
          if (opaque && Math.abs(top - last) < 0.5) {
            if (++stable >= 3) {
              resolve();
              return;
            }
          } else {
            stable = 0;
          }
          last = top;
          if (performance.now() > deadline) {
            reject(new Error('Arrow never settled'));
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      })
  );
}
const arrowText = (page: Page): Locator => arrow(page).locator('.arrow-callout__text');
const submitButton = (page: Page): Locator => page.locator('.submit-button');

function isMobile(page: Page): boolean {
  const size = page.viewportSize();
  return !!size && size.width <= MOBILE_MAX_WIDTH;
}

/** Unique per call — the client-side rate limiter keys on the email. */
function freshEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function fillValid(page: Page, overrides: Record<string, string> = {}): Promise<void> {
  const values: Record<string, string> = {
    Name: 'E2E Person',
    Email: freshEmail(),
    Message: 'This is a long enough end-to-end test message.',
    ...overrides
  };
  for (const [name, value] of Object.entries(values)) {
    await page.fill(`.contact-form [name="${name}"]`, value);
  }
}

/** Stub the POST so no submission leaves the browser or reaches the mailer. */
async function stubContactEndpoint(page: Page, status: number, body?: unknown): Promise<void> {
  await page.route('**/api/contact', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body ?? { success: status < 400, message: 'stubbed' })
    });
  });
}

/**
 * Every test in this file installs this first.
 *
 * A real POST to /api/contact does not just return a status: it writes a row to
 * the dev database and fires a genuine auto-reply email at whatever address the
 * test typed in. An early version of this spec submitted a valid form without a
 * stub and mailed a live auto-reply to `...@example.com`, which promptly
 * bounced into the real inbox. Tests must not be able to send mail.
 *
 * Playwright matches routes in reverse registration order, so the per-test
 * stubs registered afterwards still win — this is the floor, not an override.
 */
async function blockRealSubmissions(page: Page): Promise<void> {
  await page.route('**/api/contact', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'blocked by test harness' })
    });
  });
}

test.describe('Contact form', () => {
  test.beforeEach(async ({ page }) => {
    await blockRealSubmissions(page);
    await page.goto('/#/contact');
    await page.waitForSelector('.contact-form');
  });

  test('renders every field of the real form', async ({ page }) => {
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#company')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#message')).toBeVisible();
    await expect(submitButton(page)).toBeVisible();
    await expect(submitButton(page).locator('span')).toHaveText('Send Message');
  });

  test('Arrow stays off screen until there is something to say', async ({ page }) => {
    await expect(arrow(page)).toBeHidden();
  });
});

test.describe('Contact form — validation', () => {
  test.beforeEach(async ({ page }) => {
    await blockRealSubmissions(page);
    await page.goto('/#/contact');
    await page.waitForSelector('.contact-form');
  });

  test('Arrow names every missing field, and the fields go red', async ({ page }) => {
    await submitButton(page).click();

    await expect(arrow(page)).toBeVisible();
    await expect(arrowText(page)).toHaveText(
      'Almost there! Add your name, add your email, and write me a message.'
    );
    await expect(page.locator('.contact-form .input-item.error')).toHaveCount(3);
  });

  test('a single problem gets the whole instruction', async ({ page }) => {
    await fillValid(page, { Message: 'too short' });
    await submitButton(page).click();

    await expect(arrowText(page)).toHaveText('Use a few more words and I’ll take it.');
    await expect(page.locator('.contact-form .input-item.error')).toHaveCount(1);
  });

  test('a malformed email is called out specifically', async ({ page }) => {
    await fillValid(page, { Email: 'not-an-email' });
    await submitButton(page).click();

    await expect(arrowText(page)).toHaveText('Check that email for me — it’s not quite right.');
  });

  test('never shows a visitor a raw validator string', async ({ page }) => {
    await submitButton(page).click();
    await expect(arrow(page)).toBeVisible();

    const said = (await arrowText(page).textContent()) ?? '';
    for (const raw of ['is required', 'must be at least', 'Please enter a valid']) {
      expect(said).not.toContain(raw);
    }
  });

  test('nothing is sent while the form is invalid', async ({ page }) => {
    let posted = false;
    await page.route('**/api/contact', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      // Record and answer it here. `route.fallback()` would hand a real POST to
      // the real server — which is exactly what this test exists to prove does
      // not happen, and would send mail on the way to proving it.
      posted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await submitButton(page).click();
    await expect(arrow(page)).toBeVisible();
    expect(posted).toBe(false);
  });
});

test.describe('Contact form — Arrow’s controls', () => {
  test.beforeEach(async ({ page }) => {
    await blockRealSubmissions(page);
    await page.goto('/#/contact');
    await page.waitForSelector('.contact-form');
    await submitButton(page).click();
    await expect(arrow(page)).toBeVisible();
    await arrowSettled(page);
  });

  test('the X closes the blurb but leaves Arrow standing', async ({ page }) => {
    await arrow(page).locator('[data-callout-close]').click();

    await expect(arrow(page).locator('.arrow-callout__bubble')).toBeHidden();
    // She is still on screen, and still clickable.
    await expect(arrow(page)).toHaveClass(/is-active/);
    await expect(arrow(page).locator('[data-callout-mascot]')).toBeVisible();
  });

  test('clicking Arrow brings the blurb back', async ({ page }) => {
    await arrow(page).locator('[data-callout-close]').click();
    await expect(arrow(page).locator('.arrow-callout__bubble')).toBeHidden();

    await arrow(page).locator('[data-callout-mascot]').click();
    await expect(arrow(page).locator('.arrow-callout__bubble')).toBeVisible();
  });

  test('she goes away once the visitor starts fixing things', async ({ page }) => {
    await page.fill('.contact-form [name="Name"]', 'E2E Person');
    await page.fill('.contact-form [name="Email"]', freshEmail());
    await page.fill('.contact-form [name="Message"]', 'A long enough message to pass validation.');
    await submitButton(page).click();

    // clearAllErrors() runs on the next valid submit and hushes her before the
    // success blurb replaces the error one.
    await expect(page.locator('.contact-form .input-item.error')).toHaveCount(0);
  });
});

test.describe('Contact form — successful send', () => {
  test.beforeEach(async ({ page }) => {
    await blockRealSubmissions(page);
    await stubContactEndpoint(page, 200, { success: true, message: 'Message received, thanks!' });
    await page.goto('/#/contact');
    await page.waitForSelector('.contact-form');
  });

  test('the button reads SENT! and Arrow gives the 48-hour promise', async ({ page }) => {
    await fillValid(page);
    await submitButton(page).click();

    // The submit icon's bow-and-arrow animation (~1.05s) plays first, then
    // Arrow speaks — deliberately sequenced so the two don't pop together.
    await expect(submitButton(page)).toHaveClass(/form-sent/, { timeout: 10_000 });
    await expect(submitButton(page).locator('span')).toHaveText('SENT!');
    await expect(arrowText(page)).toHaveText(
      'Got it! Noelle will get back to you within 48 business hours.'
    );
  });

  test('the form is cleared so a stray second submit sends nothing', async ({ page }) => {
    await fillValid(page);
    await submitButton(page).click();
    await expect(submitButton(page)).toHaveClass(/form-sent/, { timeout: 10_000 });

    await expect(page.locator('.contact-form [name="Name"]')).toHaveValue('');
    await expect(page.locator('.contact-form [name="Email"]')).toHaveValue('');
    await expect(page.locator('.contact-form [name="Message"]')).toHaveValue('');
  });
});

test.describe('Contact form — send failures', () => {
  /**
   * These three used to be indistinguishable. submitToCustom threw a formatted
   * string, and the catch only sniffed it for 'fetch'/'network'/'404', so 429,
   * 403 and every 5xx all surfaced as the same "Unable to send message. Please
   * try again." They need three different actions from the visitor, so each
   * one is asserted separately here.
   */
  const cases = [
    { status: 429, name: 'rate limited', expect: /little while/i },
    { status: 403, name: 'stale session', expect: /refresh/i },
    { status: 500, name: 'server error', expect: /on me, not you/i },
    { status: 503, name: 'service unavailable', expect: /on me, not you/i }
  ];

  for (const { status, name, expect: pattern } of cases) {
    test(`${status} (${name}) gets its own instruction`, async ({ page }) => {
      await blockRealSubmissions(page);
      await stubContactEndpoint(page, status, { error: 'stubbed failure' });
      await page.goto('/#/contact');
      await page.waitForSelector('.contact-form');

      await fillValid(page);
      await submitButton(page).click();

      await expect(arrow(page)).toBeVisible();
      await expect(arrowText(page)).toHaveText(pattern);
      // A failed send must not claim success.
      await expect(submitButton(page)).not.toHaveClass(/form-sent/);
    });
  }

  test('a failure never leaks a status code or mechanism', async ({ page }) => {
    await blockRealSubmissions(page);
    await blockRealSubmissions(page);
    await stubContactEndpoint(page, 403, { error: 'CSRF_TOKEN_INVALID' });
    await page.goto('/#/contact');
    await page.waitForSelector('.contact-form');

    await fillValid(page);
    await submitButton(page).click();
    await expect(arrow(page)).toBeVisible();

    const said = (await arrowText(page).textContent()) ?? '';
    expect(said).not.toMatch(/csrf|token|\b4\d\d\b|\b5\d\d\b/i);
  });
});

test.describe('Contact form — Arrow’s placement', () => {
  test.beforeEach(async ({ page }) => {
    await blockRealSubmissions(page);
    await page.goto('/#/contact');
    await page.waitForSelector('.contact-form');
    await submitButton(page).click();
    await expect(arrow(page)).toBeVisible();
    await arrowSettled(page);
  });

  test('the submit button stays pressable while she is up', async ({ page }) => {
    // Reachability, not geometry. On a phone there is no gutter, so her canvas
    // necessarily overlaps the form and an overlap assertion would be wrong by
    // design. What must never happen is her SWALLOWING the tap: the canvas is
    // 540x500 of mostly-transparent art, and when the bubble layer and mascot
    // button both claimed all of it, the submit button was unpressable for the
    // whole time she was on screen.
    const blocked = await submitButton(page).evaluate((btn) => {
      const box = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return !hit?.closest('.submit-button');
    });
    expect(blocked).toBe(false);
  });

  test('her own controls are still hittable', async ({ page }) => {
    // The flip side: making the art click-through must not make HER inert.
    const closeReachable = await arrow(page)
      .locator('[data-callout-close]')
      .evaluate((el) => {
        const box = el.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return !!hit?.closest('[data-callout-close]');
      });
    expect(closeReachable).toBe(true);
  });

  test('she stays inside the viewport', async ({ page }) => {
    const her = await arrow(page).boundingBox();
    const viewport = page.viewportSize();
    expect(her).not.toBeNull();
    expect(her!.x).toBeGreaterThanOrEqual(-1);
    expect(her!.x + her!.width).toBeLessThanOrEqual(viewport!.width + 1);
  });

  test('her blurb fits the bubble without clipping', async ({ page }) => {
    const overflows = await arrowText(page).evaluate(
      (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1
    );
    expect(overflows).toBe(false);
  });

  test('desktop: she sits beside the form, not across it', async ({ page }) => {
    test.skip(isMobile(page), 'Desktop-only: below 768px there is no gutter to sit in.');

    const her = await arrow(page).boundingBox();
    const content = await page.locator('.contact-content').boundingBox();
    // Anchored to the form's right edge — she laps it slightly on purpose, but
    // her bulk is in the gutter, so her midpoint is past the form's edge.
    expect(her!.x + her!.width / 2).toBeGreaterThan(content!.x + content!.width);
  });

  test('mobile: she dips back down on her own', async ({ page }) => {
    test.skip(!isMobile(page), 'Mobile-only: she is persistent on desktop by design.');

    await expect(arrow(page)).toBeHidden({ timeout: MOBILE_AUTO_HIDE_MS + 5000 });
  });

  test('desktop: she waits to be dismissed rather than timing out', async ({ page }) => {
    test.skip(isMobile(page), 'Desktop-only.');

    await page.waitForTimeout(MOBILE_AUTO_HIDE_MS + 1000);
    await expect(arrow(page)).toBeVisible();
  });
});
