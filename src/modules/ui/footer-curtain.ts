/**
 * ===============================================
 * FOOTER CURTAIN MODULE
 * ===============================================
 * @file src/modules/ui/footer-curtain.ts
 *
 * Reveals the footer curtain as the active page reaches the end of its scroll.
 *
 * The curtain never moves. It is pinned to the bottom of the viewport and the
 * PAGE slides up off it: main#main-content carries an opaque background and a
 * higher z-index (see components/site-map.css), so the band is simply covered
 * until the content clears it. On pages that scroll for real that happens on
 * its own — content reaches the end, the viewport bottom is uncovered, no
 * transform needed. Only the map tiles, a fixed camera with nothing to
 * scroll, need this module to do the travelling, driven by the gestures
 * PageTransitionModule forwards.
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
 * its progress is tweened to match the gesture, so the curtain rises with the
 * input rather than popping in at the bottom. It eases the same way in both
 * directions — the band closes as smoothly as it opened.
 *
 * The strip the page gives up is kept blank by the tile's own static bottom
 * padding, not by anything this module writes. An earlier version grew the
 * scroller's padding-bottom in step with the reveal, which changed
 * scrollHeight — the very quantity update() reads back as `remaining` to
 * decide whether to retract. That loop stalled the reveal short of full
 * (measured y -248.5 of -270, padding 356.5px instead of 108px) and only
 * fired when a scroll event happened to land mid-tween, so it read as an
 * intermittent half-open band. Nothing here touches layout any more.
 */

import { gsap } from 'gsap';
import { BaseModule } from '../core/base';

/** Progress above which the curtain counts as open for a11y purposes. */
const OPEN_THRESHOLD = 0.98;

/** Progress change small enough to ignore, to avoid churning tweens. */
const PROGRESS_EPSILON = 0.002;

/**
 * Seconds the band takes to travel between its two ends. The same figure both
 * ways — the reveal and its reverse are one motion, and an asymmetric pair
 * reads as the band being yanked back rather than closed.
 */
const CURTAIN_SCRUB_DURATION = 0.4;

/**
 * Slop (px) for "this scroller is at its end".
 *
 * Scroll heights are fractional: a container that is visually at the bottom
 * reports ~0.5px remaining and never reaches 0. Matches SCROLL_EDGE_EPSILON in
 * page-transition.ts, which decides the same thing about the same elements.
 */
const SCROLL_END_EPSILON = 2;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export class FooterCurtainModule extends BaseModule {
  private footer: HTMLElement | null = null;
  private curtain: HTMLElement | null = null;
  private inner: HTMLElement | null = null;
  /** The content slab that slides up off the curtain. */
  private page: HTMLElement | null = null;
  /** The header. Travels with the page, and scrolls away with content. */
  private header: HTMLElement | null = null;
  private headerHeight = 0;
  /** How far the header has scrolled away, px, capped at its own height. */
  private headerScrollAway = 0;

  private timeline: gsap.core.Timeline | null = null;
  private scrubTween: gsap.core.Tween | null = null;
  /** Tween target for the scrub — GSAP eases this, the timeline follows it. */
  private readonly scrubState = { value: 0 };

  private scroller: HTMLElement | null = null;
  /** True while a gesture is driving the reveal instead of a scroll container. */
  private externalDrive = false;
  /**
   * Where the scroller sat when the band went up, so update() can tell the
   * reader scrolling back into content from the viewport merely changing
   * shape underneath a stationary page. Null until the band is raised over a
   * scroller this module can see.
   */
  private openScrollTop: number | null = null;
  private curtainHeight = 0;
  private progress = 0;
  private frame = 0;

  private pageObserver: MutationObserver | null = null;

  constructor() {
    super('FooterCurtainModule');
  }

  protected override async onInit(): Promise<void> {
    this.footer = document.querySelector<HTMLElement>('.footer');
    this.curtain = document.querySelector<HTMLElement>('[data-footer-curtain]');
    this.inner = document.querySelector<HTMLElement>('[data-footer-curtain-inner]');
    this.page = document.getElementById('main-content');
    this.header = document.querySelector<HTMLElement>('.header');

    if (!this.footer || !this.curtain || !this.inner || !this.page) {
      this.log('Curtain markup not present on this page — skipping');
      return;
    }

    this.measure();
    this.buildTimeline();
    this.applyOpenState(0);

    document.addEventListener('scroll', this.handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', this.handleResize, { passive: true });
    window.addEventListener('hashchange', this.handleNavigation);

    // The spatial-map tiles are a fixed camera sized to the viewport, so they
    // never scroll and this module would never hear from them. PageTransition-
    // Module owns the gestures there and hands us progress directly.
    window.addEventListener('footer-curtain:set-progress', this.handleExternalProgress);

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
    // Read with the header at rest, or a header already translated up would
    // measure short and cap its own travel below its real height.
    this.headerHeight = this.header ? Math.round(this.header.offsetHeight) : 0;
  }

  /**
   * The header's position, from its two independent sources: the curtain
   * reveal carrying the whole page up, and the header scrolling away with
   * content the way an in-flow header would.
   *
   * One writer on purpose. The two never overlap in practice — a tile that
   * gesture-reveals the curtain has nothing to scroll, and a page that
   * scrolls doesn't drive the curtain by gesture — but two GSAP setters on
   * the same property would still fight on the frames where both ran.
   */
  private applyHeaderOffset(curtainProgress: number): void {
    if (!this.header) return;

    // Only the scroll-away half is ever skipped. The curtain half must always
    // apply: a gesture reveal slides the whole page up off the band, and the
    // header is part of that page — dropping it there left the header sitting
    // at the top while the content moved out from under it.
    //
    // A static header covers its own scroll-away ONLY when the thing scrolling
    // is the document it sits in — project-detail on desktop, where the header
    // is un-fixed (pages/projects-detail.css) and the whole page scrolls.
    // Inside the fixed-camera layout the scroller is a TILE and body/main
    // carry overflow: hidden, so a static header outside that tile never moves
    // on its own however far the tile scrolls.
    const scrollAway = this.headerTravelsInFlow() ? 0 : this.headerScrollAway;

    gsap.set(this.header, {
      y: -(curtainProgress * this.curtainHeight) - scrollAway
    });
  }

  /**
   * Whether the header moves on its own with the content, so this module
   * should keep its hands off it.
   */
  private headerTravelsInFlow(): boolean {
    if (!this.header) return true;
    if (getComputedStyle(this.header).position !== 'static') return false;

    // No scroller at all means nothing is scrolling, so there is no
    // scroll-away to skip — and answering "true" here would be read as
    // "the header handles itself", which it does not.
    const scroller = this.scroller;
    if (scroller === null) return false;

    return (
      scroller === document.scrollingElement ||
      scroller === document.documentElement ||
      scroller === document.body
    );
  }

  /** Track how far content has scrolled under the header, capped at its height. */
  private setHeaderScrollAway(scrollTop: number): void {
    this.headerScrollAway = Math.min(Math.max(0, scrollTop), this.headerHeight);
    // Applied unconditionally rather than only on a changed value. Memoising
    // this left the header stuck off-screen: any frame where the offset was
    // already "correct" but the transform had been written by something else
    // never got corrected, because the guard returned before re-applying.
    // gsap.set is cheap enough that self-correcting every frame is the better
    // trade than a desync that only a second scroll gesture can clear.
    this.applyHeaderOffset(this.scrubState.value);
  }

  /**
   * Build the paused reveal. Every tween is `ease: 'none'` and one unit long
   * so the timeline reads as a 0..1 scrub; the easing the user feels comes
   * from the tween that moves `progress`, not from the timeline itself.
   */
  private buildTimeline(): void {
    if (!this.page || !this.inner) return;

    const tl = gsap.timeline({ paused: true });

    // The PAGE travels up by exactly the curtain's height, uncovering the band
    // that was underneath it all along. The curtain itself never moves —
    // sliding the panel up over the content is the effect this is not.
    tl.fromTo(this.page, { y: 0 }, { y: -this.curtainHeight, ease: 'none', duration: 1 }, 0);

    // Contents trail the page edge, so the band reads as settling into place
    // as it's uncovered rather than arriving fully formed.
    tl.fromTo(
      this.inner,
      { y: 0, yPercent: 25, opacity: 0 },
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
    if (!this.ownsCurtain(element)) return;
    // Scroll still reaches update() while a gesture owns the curtain — update()
    // decides what to do with it. Returning early here meant the reader could
    // scroll back up off the end of a case study with the band still raised,
    // and update()'s retract check could never fire, so the last screenful of
    // content sat behind the footer.
    this.scroller = element;
    this.requestUpdate();
  };

  /**
   * Whether a scrolling element is one the curtain actually belongs to.
   *
   * This listens on document in the CAPTURE phase, so it hears from every
   * scrollable box on the page, not just the page's own scroller. Most of them
   * are noise: a `<label class="sr-only">` measures 22px tall in a 1px box and
   * a `.menu-button-text` 43 in 20, so both report a permanent ~20px of
   * "remaining scroll" from sub-pixel rounding. Adopting one of those as the
   * scroller scrolled the header away for no reason, and — once update() grew
   * a close-guard — shut the curtain the moment anything asked for an update.
   *
   * The real candidates are a map tile (each owns its own overflow) or, on the
   * standalone document-scrolling shells, the document itself.
   */
  private ownsCurtain(element: HTMLElement): boolean {
    return (
      element.hasAttribute('data-map-tile') ||
      element === document.scrollingElement ||
      element === document.documentElement ||
      element === document.body
    );
  }

  /**
   * Progress handed in by PageTransitionModule for tiles that have no scroll
   * of their own. Anything above 0 means a gesture owns the curtain.
   */
  private handleExternalProgress = (event: Event): void => {
    const detail = (event as CustomEvent<{ progress?: number }>).detail;
    const next = clamp01(typeof detail?.progress === 'number' ? detail.progress : 0);

    const wasDriving = this.externalDrive;
    this.externalDrive = next > 0;
    // Anchor the moment the band goes up, while the scroller is still parked
    // at the end the gesture raised it from. Leaving this to update()'s lazy
    // branch meant the FIRST scroll after opening was spent recording the
    // anchor instead of being judged against it, so the one gesture the guard
    // exists to catch — a scrollbar drag back into the page — was the one it
    // always missed.
    if (!this.externalDrive) {
      this.openScrollTop = null;
    } else if (!wasDriving) {
      this.openScrollTop = this.scroller ? this.scroller.scrollTop : null;
    }
    this.setProgress(next);
  };

  private handleResize = (): void => {
    const previous = this.curtainHeight;
    this.measure();

    // The page's travel distance is baked into the tween as a pixel value, so
    // a curtain that changed height needs the timeline rebuilt around the new
    // one — otherwise the page stops short of the band or overshoots it.
    if (this.curtainHeight !== previous) {
      this.scrubTween?.kill();
      this.scrubTween = null;
      this.timeline?.kill();
      if (this.page) gsap.set(this.page, { y: 0 });

      // buildTimeline() overwrites this.timeline, so it is not cleared first:
      // assigning null here would narrow the field and TS can't see the
      // rebuild put a timeline back.
      this.buildTimeline();

      const target = this.externalDrive ? this.progress : 0;
      this.scrubState.value = target;
      this.timeline?.progress(target);
      this.applyHeaderOffset(target);
    }

    // A resize is not the reader moving. Re-anchor, or a viewport that GREW
    // would shrink the scroller's maximum scroll, let the browser clamp
    // scrollTop down to fit, and have the guard read that clamp as scrolling
    // back into content — closing the band on a window drag.
    if (this.externalDrive && this.scroller) {
      this.openScrollTop = this.scroller.scrollTop;
    }

    this.requestUpdate();
  };

  /**
   * Page changes reset the curtain: the new page starts at its own scroll
   * top, and the old scroller is no longer what the user is looking at.
   *
   * Dropping the scroller reference matters as much as dropping the progress.
   * A page that fits never scrolls, so no further scroll event would arrive to
   * correct a curtain left tracking the container the user has navigated away
   * from, and the band would be stranded open.
   */
  private handleNavigation = (): void => {
    this.scroller = null;
    this.externalDrive = false;
    this.openScrollTop = null;
    this.setHeaderScrollAway(0);
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
      this.setHeaderScrollAway(0);
      return;
    }

    // The band is only ever raised over the blank strip at the very end of a
    // scroller. If the scroller leaves that end while the band is up, the strip
    // is content again, so the band comes down rather than sitting on top of
    // it. PageTransitionModule intercepts the wheel and closes the curtain
    // itself, so in practice this only catches the routes it never sees —
    // keyboard, a scrollbar drag, an anchor jump.
    //
    // The test is "has the reader MOVED back up", not "is there scroll left
    // below". Those are the same thing while the viewport holds still, and
    // different the moment it doesn't: shrinking the window leaves the
    // scroller parked exactly where it was but gives it a shorter box, so a
    // plain `remaining > 0` test read a resize as the reader scrolling away
    // and slammed the band shut every time the window changed size. Comparing
    // against the position the band was raised at ignores reshaping and
    // catches only real movement.
    if (this.externalDrive) {
      if (this.openScrollTop === null) {
        this.openScrollTop = element.scrollTop;
      } else if (element.scrollTop < this.openScrollTop - SCROLL_END_EPSILON) {
        this.externalDrive = false;
        this.openScrollTop = null;
        this.setProgress(0);
        // Tell the gesture owner, or its banked travel would still read as
        // "open" and the next wheel up would spend itself closing a band that
        // is already down.
        window.dispatchEvent(new CustomEvent('footer-curtain:closed'));
      }
    }

    // Scroll only moves the header. The curtain itself is driven entirely by
    // gesture — PageTransitionModule on the tiles that do not scroll, and the
    // end of a case study on the one that does.
    //
    // It used to be scrubbed from scroll position here, which made sense when
    // project-detail scrolled the whole document and clearing the viewport
    // bottom genuinely uncovered the band. Inside the fixed camera main always
    // covers it, so that path could only ever fight the gesture for control of
    // the same timeline.
    this.setHeaderScrollAway(element.scrollTop);
  };

  /** Drive the timeline, the header and the scrub state to one exact value. */
  private applyImmediate(value: number): void {
    if (!this.timeline) return;
    this.scrubState.value = value;
    this.timeline.progress(value);
    this.applyHeaderOffset(value);
  }

  private setProgress(next: number): void {
    if (!this.timeline) return;

    const changed = Math.abs(next - this.progress) >= PROGRESS_EPSILON;

    this.progress = next;
    this.applyOpenState(next);

    // An unchanged value still has to be re-applied. A tween killed partway
    // through leaves the timeline stranded — the page stuck half-raised with
    // the band showing through — and every later call would take the early
    // return and never correct it. This is what left content behind the footer
    // after scrolling back to the top.
    if (!changed) {
      if (!this.scrubTween || !this.scrubTween.isActive()) {
        this.applyImmediate(this.externalDrive ? next : 0);
      }
      return;
    }

    // Where the page scrolls for real, the reveal is already happening: the
    // content clears the viewport bottom and the band is uncovered, no
    // transform involved. Sliding the page as well would move it twice as far
    // as the user scrolled. Only the gesture-driven tiles — a fixed camera
    // with nothing to scroll — need the timeline to do the travelling.
    const target = this.externalDrive ? next : 0;

    this.scrubTween?.kill();

    if (this.reducedMotion) {
      this.applyImmediate(target);
      this.scrubTween = null;
      return;
    }

    // One ease for both directions. Retracting used to snap, on the grounds
    // that a trailing tween would leave the band over content the scroll had
    // already brought back — but that was only true while this module grew the
    // scroller's padding underneath it. The band now travels with the page and
    // nothing else moves, so closing can take exactly as long as opening did.
    //
    // Ease a plain number and push it into the timeline on each tick. Easing
    // the timeline's own progress directly is possible but leaves nothing to
    // inspect when it misbehaves; this keeps the driver explicit.
    const timeline = this.timeline;
    this.scrubTween = gsap.to(this.scrubState, {
      value: target,
      duration: CURTAIN_SCRUB_DURATION,
      ease: 'power3.out',
      overwrite: true,
      onUpdate: () => {
        timeline.progress(this.scrubState.value);
        this.applyHeaderOffset(this.scrubState.value);
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
    window.removeEventListener('footer-curtain:set-progress', this.handleExternalProgress);

    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }

    this.pageObserver?.disconnect();
    this.pageObserver = null;

    this.scrubTween?.kill();
    this.scrubTween = null;

    // Never leave the page slid up — the module is gone, nothing would put
    // it back, and the user would be looking at a permanently shifted site.
    if (this.page) gsap.set(this.page, { y: 0 });
    if (this.header) gsap.set(this.header, { y: 0 });

    this.footer = null;
    this.curtain = null;
    this.inner = null;
    this.page = null;
    this.header = null;
    this.timeline = null;
    this.scroller = null;

    this.log('Footer curtain destroyed');
  }
}
