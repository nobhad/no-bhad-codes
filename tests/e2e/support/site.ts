/**
 * ===============================================
 * E2E SHARED SITE HELPERS
 * ===============================================
 * @file tests/e2e/support/site.ts
 *
 * Waiting helpers for the main site's spatial map. Lives outside the default
 * testMatch glob (`**\/*.spec.ts`) so Playwright treats it as a module, not a
 * suite with no tests in it.
 */

import type { Page } from '@playwright/test';

/**
 * Wait for the intro to hand over.
 *
 * The paw animation runs for about four and a half seconds on a cold load,
 * during which the site deliberately holds navigation. Anything that starts
 * inside that window races the animation rather than testing the page.
 */
export async function introFinished(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.documentElement.classList.contains('intro-finished'),
    null,
    { timeout: 20000 }
  );
}

/**
 * Wait until the camera has actually landed on `pageId` and stopped moving.
 *
 * A bare `goto('/#/about')` may reload the document, and on a fresh document
 * the intro runs for about four and a half seconds before the router will act
 * on anything — longer than an assertion's default window. Asking the app when
 * it has arrived beats guessing how long it takes.
 */
export async function settledOn(page: Page, pageId: string): Promise<void> {
  // `intro-complete`, not `intro-finished`. Both are set when the paw hands
  // over, but `intro-finished` is CLEARED the moment you navigate away from the
  // intro (intro-animation.ts:880) — so every settledOn after the first
  // navigation sat waiting 25s for a class the app had already removed, and the
  // back/forward test failed as a timeout here rather than on anything to do
  // with history. `intro-complete` persists for the life of the document.
  await page.waitForFunction(
    () => document.documentElement.classList.contains('intro-complete'),
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

/**
 * Wait for everything matching `selector` to be fully opaque and stationary.
 *
 * `settledOn` asks the router whether it has arrived, and it answers as soon as
 * it has set the new page — but GSAP is still tweening the tile's autoAlpha and
 * the camera is still gliding. Anything that samples computed styles in that
 * window reads blended colours: an axe contrast scan of the about page landed
 * mid-fade and reported #979797 text on #e0e0e0, a colour that exists for about
 * a third of a second and is in no stylesheet. The menu does the same on open,
 * with a stagger, so its red numerals read as four different pinks.
 *
 * Three consecutive frames with full opacity and a stationary box is the same
 * test the contact-form suite uses for Arrow, and for the same reason.
 */
export async function settled(page: Page, selector: string): Promise<void> {
  await page.evaluate(
    (sel) =>
      new Promise<void>((resolve, reject) => {
        const els = Array.from(document.querySelectorAll<HTMLElement>(sel));
        if (els.length === 0) {
          reject(new Error(`Nothing matched "${sel}"`));
          return;
        }
        const deadline = performance.now() + 8000;
        let last: number[] = [];
        let stable = 0;
        const tick = (): void => {
          const tops = els.map((el) => el.getBoundingClientRect().top);
          const opaque = els.every((el) => parseFloat(getComputedStyle(el).opacity) > 0.99);
          const still =
            last.length === tops.length && tops.every((t, i) => Math.abs(t - last[i]) < 0.5);
          if (opaque && still) {
            if (++stable >= 3) {
              resolve();
              return;
            }
          } else {
            stable = 0;
          }
          last = tops;
          if (performance.now() > deadline) {
            reject(new Error(`"${sel}" never settled`));
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      }),
    selector
  );
}

/**
 * Wait for every running CSS transition to finish.
 *
 * The standalone pages set data-theme from a blocking head script, which
 * triggers the theme transition (~350ms of background-color, color and
 * border-color) on everything that declares one. axe sampled the 404 inside
 * that window and reported the primary button as #a5a5f9 on #707070 — a
 * blend of black-on-white with the page showing through, and a colour pair
 * that exists nowhere in the stylesheet.
 *
 * Filtered to CSSTransition on purpose: `document.getAnimations()` also
 * returns infinite CSS animations — the about marquee, for one — which never
 * reach a finished state and would hang this forever.
 */
export async function transitionsSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter((a) => a instanceof CSSTransition)
        .every((a) => a.playState === 'finished' || a.playState === 'idle'),
    null,
    { timeout: 8000 }
  );
}

/** The active map tile, once the camera and the fade have both finished. */
export async function pageSettled(page: Page, pageId: string): Promise<void> {
  await settled(page, `section[data-page="${pageId}"]`);
}

/**
 * Load the main site and drive the camera to `pageId`.
 *
 * Navigate by hash rather than by `goto('/#/about')`: goto reloads the
 * document, which restarts the intro we have just waited out. Setting the hash
 * on the live document is what the router listens for.
 */
export async function gotoPage(page: Page, hash: string, pageId: string): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('[data-nav]', { state: 'attached' });
  await introFinished(page);

  if (hash !== '#/') {
    await page.evaluate((h) => {
      window.location.hash = h;
    }, hash);
  }

  await settledOn(page, pageId);
  await pageSettled(page, pageId);
}
