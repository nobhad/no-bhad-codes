/**
 * ===============================================
 * TABLE ANIMATOR
 * ===============================================
 * @file src/features/shared/table-manager/TableAnimator.ts
 *
 * GSAP animations for table interactions:
 * - Stagger fade-in on initial render
 * - Crossfade for pagination
 * - Subtle reorder for sort
 */

import { SELECTORS, ANIMATION } from './constants';

export class TableAnimator {
  private rootEl: HTMLElement;

  constructor(rootEl: HTMLElement) {
    this.rootEl = rootEl;
  }

  /** Stagger fade-in rows on initial table render */
  animateInitialRows(): void {
    if (typeof gsap === 'undefined') return;

    const rows = this.rootEl.querySelectorAll<HTMLElement>(SELECTORS.ROW);
    if (rows.length === 0) return;

    // Limit stagger count for performance
    const animateCount = Math.min(rows.length, ANIMATION.MAX_STAGGER_ROWS);
    const rowsToAnimate = Array.from(rows).slice(0, animateCount);

    gsap.fromTo(
      rowsToAnimate,
      { opacity: 0, y: 6 },
      {
        opacity: 1,
        y: 0,
        duration: ANIMATION.ROW_FADE_IN,
        stagger: ANIMATION.ROW_STAGGER,
        ease: 'power2.out',
        clearProps: 'transform'
      }
    );
  }

  /** Animate the bulk toolbar appearing */
  animateToolbarIn(toolbar: HTMLElement): void {
    if (typeof gsap === 'undefined') return;

    gsap.fromTo(
      toolbar,
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, duration: ANIMATION.TOOLBAR_TOGGLE, ease: 'power2.out' }
    );
  }

  /** Animate the bulk toolbar disappearing */
  animateToolbarOut(toolbar: HTMLElement, onComplete: () => void): void {
    if (typeof gsap === 'undefined') {
      onComplete();
      return;
    }

    gsap.to(toolbar, {
      opacity: 0,
      y: -8,
      duration: ANIMATION.TOOLBAR_TOGGLE,
      ease: 'power2.in',
      onComplete
    });
  }

  /** Animate the table card appearing when loaded into a tab */
  animateTableIn(): void {
    if (typeof gsap === 'undefined') return;

    const card = this.rootEl;
    gsap.fromTo(
      card,
      { opacity: 0 },
      { opacity: 1, duration: ANIMATION.ROW_FADE_IN, ease: 'power2.out' }
    );
  }
}
