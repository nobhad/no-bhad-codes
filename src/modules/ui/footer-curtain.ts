/**
 * ===============================================
 * FOOTER CURTAIN MODULE
 * ===============================================
 * @file src/modules/ui/footer-curtain.ts
 *
 * Reveals the black footer curtain as the active page reaches the end of
 * its scroll.
 *
 * The site is a virtual-page map: <main> is fixed and each tile
 * (.site-map > [data-map-tile]) owns its own overflow, while off-map pages
 * like #project-detail scroll either themselves or <main>. There is no
 * document scroll to hang a ScrollTrigger off, so instead of guessing which
 * element is the scroller we listen for scroll in the capture phase on
 * document — scroll doesn't bubble, but capture listeners on ancestors still
 * fire — and treat whichever element scrolled as the current scroller.
 *
 * The reveal is scrubbed, not toggled: a GSAP timeline is built paused and
 * its progress is tweened to match how much of the final stretch of scroll
 * the user has consumed, so the curtain rises with the scroll rather than
 * popping in at the bottom.
 *
 * Scrollable containers get a bottom padding equal to the curtain height so
 * the panel rises into empty space instead of covering the last of the
 * content. Non-scrolling tiles (the intro business card, about/contact on
 * desktop) never overflow, so they never get padding and never reveal.
 */

import { gsap } from 'gsap';
import { BaseModule } from '../core/base';

/** Slop (px) for deciding a container genuinely overflows. */
const OVERFLOW_EPSILON = 2;

/** Floor (px) for the scrub distance so very short overflows still animate. */
const MIN_REVEAL_DISTANCE = 96;

/** Progress above which the curtain counts as open for a11y purposes. */
const OPEN_THRESHOLD = 0.98;

/** Progress change small enough to ignore, to avoid churning tweens. */
const PROGRESS_EPSILON = 0.002;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export class FooterCurtainModule extends BaseModule {
  private footer: HTMLElement | null = null;
  private curtain: HTMLElement | null = null;
  private inner: HTMLElement | null = null;

  private timeline: gsap.core.Timeline | null = null;
  private scrubTween: gsap.core.Tween | null = null;
  /** Tween target for the scrub — GSAP eases this, the timeline follows it. */
  private readonly scrubState = { value: 0 };

  private scroller: HTMLElement | null = null;
  private curtainHeight = 0;
  private progress = 0;
  private frame = 0;

  /** Containers we've added bottom padding to, with their prior inline value. */
  private padded = new Map<HTMLElement, string>();
  private pageObserver: MutationObserver | null = null;

  constructor() {
    super('FooterCurtainModule');
  }

  protected override async onInit(): Promise<void> {
    this.footer = document.querySelector<HTMLElement>('.footer');
    this.curtain = document.querySelector<HTMLElement>('[data-footer-curtain]');
    this.inner = document.querySelector<HTMLElement>('[data-footer-curtain-inner]');

    if (!this.footer || !this.curtain || !this.inner) {
      this.log('Curtain markup not present on this page — skipping');
      return;
    }

    this.measure();
    this.buildTimeline();
    this.applyOpenState(0);

    document.addEventListener('scroll', this.handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', this.handleResize, { passive: true });
    window.addEventListener('hashchange', this.handleNavigation);

    // PageTransitionModule can swap pages from a wheel/arrow/swipe gesture as
    // well as from a hash change, and it always stamps the result on <main>.
    // Watching the attribute catches every route in one place.
    const main = document.getElementById('main-content');
    if (main) {
      this.pageObserver = new MutationObserver(this.handleNavigation);
      this.pageObserver.observe(main, { attributes: true, attributeFilter: ['data-active-page'] });
    }

    this.log('Footer curtain ready');
  }

  /**
   * Cache the rendered curtain height. Read from the element rather than the
   * CSS custom property so the clamp() in footer.css stays the single source
   * of truth.
   */
  private measure(): void {
    if (!this.curtain) return;
    this.curtainHeight = Math.round(this.curtain.getBoundingClientRect().height);
  }

  /**
   * Build the paused reveal. Every tween is `ease: 'none'` and one unit long
   * so the timeline reads as a 0..1 scrub; the easing the user feels comes
   * from the tween that moves `progress`, not from the timeline itself.
   */
  private buildTimeline(): void {
    if (!this.curtain || !this.inner) return;

    const tl = gsap.timeline({ paused: true });

    // `y: 0` is pinned on both ends deliberately. footer.css parks the panel
    // with transform: translateY(100%) for the pre-JS frame, and GSAP would
    // otherwise read that as a 231px `y` base and stack yPercent on top of it,
    // leaving the curtain a full height lower than intended.
    tl.fromTo(
      this.curtain,
      { y: 0, yPercent: 100 },
      { y: 0, yPercent: 0, ease: 'none', duration: 1 },
      0
    );

    // Contents trail the panel edge so the curtain feels like it's rising
    // over them rather than being one rigid block.
    tl.fromTo(
      this.inner,
      { y: 0, yPercent: 40, opacity: 0 },
      { y: 0, yPercent: 0, opacity: 1, ease: 'none', duration: 1 },
      0
    );

    this.timeline = tl;
    this.addTimeline(tl);
  }

  private handleScroll = (event: Event): void => {
    const target = event.target;
    let element: HTMLElement | null = null;

    if (target instanceof HTMLElement) {
      element = target;
    } else if (target === document || target === window) {
      element = document.scrollingElement as HTMLElement | null;
    }

    if (!element) return;
    // Scrolling inside the curtain itself must not drive the curtain.
    if (this.footer?.contains(element)) return;

    this.scroller = element;
    this.requestUpdate();
  };

  private handleResize = (): void => {
    this.measure();
    // Padding is sized from the curtain height, so re-apply it at the new size.
    this.padded.forEach((_original, element) => this.unpad(element));
    this.requestUpdate();
  };

  /**
   * Page changes reset the curtain: the new page starts at its own scroll
   * top, and the old scroller is no longer what the user is looking at.
   *
   * The old container's spacer has to go with it. Left in place it keeps the
   * document overflowing at its old length, and — since nothing scrolls on a
   * page that fits — no further scroll event would ever arrive to correct the
   * curtain, stranding it open.
   */
  private handleNavigation = (): void => {
    this.scroller = null;
    Array.from(this.padded.keys()).forEach((element) => this.unpad(element));
    this.setProgress(0);
  };

  private requestUpdate(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(this.update);
  }

  private update = (): void => {
    this.frame = 0;

    const element = this.scroller;
    if (!element || !element.isConnected) {
      this.setProgress(0);
      return;
    }

    if (!this.ensurePadding(element)) {
      this.setProgress(0);
      return;
    }

    const maxScroll = element.scrollHeight - element.clientHeight;
    if (maxScroll <= OVERFLOW_EPSILON) {
      this.setProgress(0);
      return;
    }

    // Scrub across the last curtain-height of travel, but never demand more
    // travel than the container actually has.
    const distance = Math.max(MIN_REVEAL_DISTANCE, Math.min(this.curtainHeight, maxScroll));
    const remaining = maxScroll - element.scrollTop;

    this.setProgress(1 - clamp01(remaining / distance));
  };

  /**
   * Give a genuinely overflowing container room for the curtain to rise into.
   *
   * @returns whether the container overflows on its own content.
   */
  private ensurePadding(element: HTMLElement): boolean {
    const isPadded = this.padded.has(element);
    const naturalHeight = element.scrollHeight - (isPadded ? this.curtainHeight : 0);
    const overflows = naturalHeight > element.clientHeight + OVERFLOW_EPSILON;

    if (overflows && !isPadded) {
      const existing = parseFloat(getComputedStyle(element).paddingBottom) || 0;
      this.padded.set(element, element.style.paddingBottom);
      // Inline so it wins over the layered/unlayered page rules that set
      // padding on these sections.
      element.style.paddingBottom = `${existing + this.curtainHeight}px`;
    } else if (!overflows && isPadded) {
      this.unpad(element);
    }

    return overflows;
  }

  private unpad(element: HTMLElement): void {
    const original = this.padded.get(element);
    if (original === undefined) return;
    element.style.paddingBottom = original;
    this.padded.delete(element);
  }

  private setProgress(next: number): void {
    if (!this.timeline) return;
    if (Math.abs(next - this.progress) < PROGRESS_EPSILON) return;

    const retracting = next < this.progress;

    this.progress = next;
    this.applyOpenState(next);

    this.scrubTween?.kill();

    // Retracting is snapped, not tweened. The padding guarantees the panel
    // only ever covers empty space, but only while its position matches the
    // scroll exactly — a trailing tween on the way back up leaves the black
    // band sitting over content that has already scrolled back into view.
    // Opening keeps the ease: there the lag plays out inside the padding.
    if (retracting || this.reducedMotion) {
      this.scrubState.value = next;
      this.timeline.progress(next);
      this.scrubTween = null;
      return;
    }

    // Ease a plain number and push it into the timeline on each tick. Easing
    // the timeline's own progress directly is possible but leaves nothing to
    // inspect when it misbehaves; this keeps the driver explicit.
    const timeline = this.timeline;
    this.scrubTween = gsap.to(this.scrubState, {
      value: next,
      duration: 0.4,
      ease: 'power3.out',
      overwrite: true,
      onUpdate: () => {
        timeline.progress(this.scrubState.value);
      }
    });
  }

  /**
   * Keep the curtain out of the accessibility tree and the tab order until
   * it's actually on screen.
   */
  private applyOpenState(progress: number): void {
    if (!this.curtain) return;
    const open = progress > OPEN_THRESHOLD;
    this.curtain.setAttribute('aria-hidden', open ? 'false' : 'true');
    this.curtain.inert = !open;
    this.footer?.classList.toggle('footer--curtain-open', progress > PROGRESS_EPSILON);
  }

  protected override async onDestroy(): Promise<void> {
    document.removeEventListener('scroll', this.handleScroll, { capture: true });
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('hashchange', this.handleNavigation);

    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }

    this.pageObserver?.disconnect();
    this.pageObserver = null;

    this.scrubTween?.kill();
    this.scrubTween = null;

    Array.from(this.padded.keys()).forEach((element) => this.unpad(element));

    this.footer = null;
    this.curtain = null;
    this.inner = null;
    this.timeline = null;
    this.scroller = null;

    this.log('Footer curtain destroyed');
  }
}
