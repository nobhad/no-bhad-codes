/**
 * ARROW CALLOUT — mascot + speech-bubble annotation blurb.
 *
 * Framework-agnostic. Call `initArrowCallouts()` once after the markup exists;
 * it wires every `[data-arrow-callout]` on the page.
 *
 * Behaviour
 *   • One mascot is on screen at a time, parked in its corner — the active
 *     callout's. (With a single callout, that's always it.)
 *   • Exactly ONE blurb is open at a time: the one whose section sits at the
 *     viewport's vertical centre.
 *   • The close X dismisses the current blurb until you scroll to a DIFFERENT
 *     section; clicking the mascot re-opens it.
 *
 * Section position is read from LAYOUT offsets (offsetTop/offsetHeight), NOT
 * getBoundingClientRect or IntersectionObserver, so scroll-driven transforms on
 * the host page (GSAP scroll-draw, parallax, pinning) can't fool it into opening
 * the wrong blurb or several at once.
 *
 * Markup contract (see README / demo):
 *   [data-arrow-callout]          the root <aside>
 *     [data-callout-bubble]       the blurb layer
 *     [data-callout-close]        the X button
 *     [data-callout-mascot]       the mascot button
 *   Optional on the root:
 *     data-callout-mascot-action="open"  mascot only opens (default: toggles)
 *     data-callout-portal="false" leave the callout in place (default: portal to
 *                                 <body> so no transformed ancestor traps its
 *                                 position: fixed)
 *     data-callout-open="auto"    (default) open by scroll position
 *     data-callout-open="always"  open unless dismissed — for a single callout,
 *                                 or one inside a pinned section whose layout
 *                                 offsets aren't meaningful
 *     data-callout-open="manual"  scroll position is ignored entirely; the
 *                                 callout is hidden (mascot included) until the
 *                                 host calls open(), and hidden again on
 *                                 close(). The X in between closes just the
 *                                 BLURB — the mascot stays put so the note can
 *                                 be called back. For callouts that answer an
 *                                 EVENT rather than a place: form feedback, a
 *                                 save confirmation.
 *     data-callout-id="<name>"    address this callout in open()/close()
 *     data-callout-ready="<selector>"  hold the blurb closed until that element
 *                                 has computed opacity > 0.5 (e.g. wait out an
 *                                 intro animation before the blurb pops)
 *
 * Manual callouts are driven by the returned controller:
 *   const callouts = initArrowCallouts({ onOpen, onClose });
 *   callouts.open('form-feedback', "That email looks off to me.");
 *   callouts.close('form-feedback');
 * `onOpen`/`onClose` exist so a host can animate the pop without this file
 * taking a dependency on an animation library — it only toggles the classes.
 */

/**
 * @typedef {Object} ArrowCalloutOptions
 * @property {ParentNode} [root=document]        Where to look for callouts.
 * @property {string} [sectionSelector='section'] Fallback ancestor treated as
 *   "the section this callout belongs to". An explicit
 *   `[data-callout-section]` ancestor always wins.
 * @property {(callout: HTMLElement) => void} [onOpen]   Fired after a blurb opens.
 * @property {(callout: HTMLElement) => void} [onClose]  Fired after one closes.
 */

/**
 * @param {ArrowCalloutOptions} [options]
 * @returns {{
 *   refresh: () => void,
 *   destroy: () => void,
 *   open: (target?: string | HTMLElement, text?: string) => void,
 *   close: (target?: string | HTMLElement) => void,
 *   isOpen: (target?: string | HTMLElement) => boolean,
 * }}
 */
export function initArrowCallouts(options = {}) {
  const root = options.root ?? document;
  const sectionSelector = options.sectionSelector ?? 'section';

  const entries = Array.from(
    root.querySelectorAll('[data-arrow-callout]'),
  ).map((callout) => {
    // Remember the section BEFORE portaling, then move the callout to <body> so
    // no transformed ancestor can trap its position: fixed. (A transformed
    // ancestor becomes the containing block for fixed descendants — the callout
    // would scroll with that ancestor instead of the viewport. This bit the
    // original on pages with scroll-driven transforms.) Anchored callouts opt
    // out: they are deliberately positioned inside an ancestor.
    const portal =
      !callout.classList.contains('arrow-callout--anchored') &&
      callout.dataset.calloutPortal !== 'false';
    const home = portal ? { parent: callout.parentNode, next: callout.nextSibling } : null;
    const section =
      callout.closest('[data-callout-section]') ??
      callout.closest(sectionSelector);

    const manual = callout.dataset.calloutOpen === 'manual';
    const entry = {
      callout,
      home,
      id: callout.dataset.calloutId ?? null,
      section: section ?? callout.parentElement,
      /** Manual callouts answer an event, not a place — no scroll math at all. */
      manual,
      /** Host-driven open state; only meaningful for manual callouts. */
      forced: false,
      /** "always" callouts ignore scroll position; so does one with no section. */
      always: !manual && (callout.dataset.calloutOpen === 'always' || !section),
      /** Gate: hold closed until this element has faded in. */
      readyGate: callout.dataset.calloutReady
        ? document.querySelector(callout.dataset.calloutReady)
        : null,
      ready: !callout.dataset.calloutReady,
      dismissed: false,
      /** Last rendered open state, so the hooks fire on transitions only. */
      wasOpen: false,
      /** Pending auto-close / exit-phase timers, cancelled on any state change. */
      autoCloseTimer: null,
      exitTimer: null,
    };
    if (manual) callout.classList.add('arrow-callout--manual');
    if (portal) document.body.appendChild(callout);
    return entry;
  });

  const noop = {
    refresh() {},
    destroy() {},
    open() {},
    close() {},
    isOpen: () => false,
  };
  if (!entries.length) return noop;

  /** Document-space top — offsetTop up the offsetParent chain, which (unlike
   *  getBoundingClientRect) ignores transforms. */
  const docTop = (el) => {
    let y = 0;
    for (let node = el; node; node = node.offsetParent) y += node.offsetTop;
    return y;
  };

  let active = null;   // owns the visible mascot
  let centred = null;  // section is at the viewport centre → its blurb may open

  const render = () => {
    for (const entry of entries) {
      // A manual callout has THREE states, not two: away entirely, present
      // with the blurb closed, and present with the blurb open. `forced` is
      // whether she has been summoned at all (mascot on screen); `dismissed`
      // collapses just the blurb, so the X puts the note away without putting
      // HER away — she stays reachable to bring it back.
      const summoned = entry.manual ? entry.forced : entry === active;
      const open = entry.manual
        ? entry.forced && !entry.dismissed
        : entry === centred && entry.ready && !entry.dismissed;

      entry.callout.classList.toggle('is-active', summoned);
      entry.callout.classList.toggle('is-blurb-open', open);

      // Fire the host hooks on the TRANSITION only, so an animation callback
      // isn't re-run by every scroll frame that re-renders the same state.
      if (open !== entry.wasOpen) {
        entry.wasOpen = open;
        (open ? options.onOpen : options.onClose)?.(entry.callout);
      }
    }
  };

  const checkGates = () => {
    for (const entry of entries) {
      if (entry.ready) continue;
      const gate = entry.readyGate;
      if (!gate || parseFloat(getComputedStyle(gate).opacity) > 0.5) {
        entry.ready = true;
      }
    }
  };

  const update = () => {
    const mid = window.scrollY + window.innerHeight / 2;
    let hit = null;        // section actually spans the viewport centre
    let hitDist = Infinity;
    let nearest = null;    // closest section either way — owns the mascot
    let nearestDist = Infinity;

    for (const entry of entries) {
      if (entry.manual) continue;                   // event-driven, not placed
      if (entry.always || !entry.section) continue; // decided below
      const top = docTop(entry.section);
      const height = entry.section.offsetHeight;
      const dist = Math.abs(mid - (top + height / 2));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entry;
      }
      if (mid < top || mid >= top + height) continue;
      if (dist < hitDist) {
        hitDist = dist;
        hit = entry;
      }
    }

    // An "always" callout is the default open blurb, yielding whenever another
    // section's blurb is centred.
    const alwaysEntry = entries.find((e) => e.always && !e.manual) ?? null;
    if (!hit && alwaysEntry && alwaysEntry.ready) hit = alwaysEntry;

    if (hit !== centred) {
      // Leaving a section clears its dismissal, so it can pop again next visit.
      if (centred) centred.dismissed = false;
      centred = hit;
    }

    // Exactly one mascot is ever on screen: the open blurb's, else the nearest
    // callout's, so it stays reachable in the gaps between annotated sections.
    // (Every callout is fixed to the same corner — without this they'd stack.)
    // Manual callouts are excluded: they show their own mascot only while open,
    // so they must never be handed the corner just for being the last resort.
    active = centred ?? nearest ?? alwaysEntry ?? entries.find((e) => !e.manual) ?? null;

    render();
  };

  /** @type {Array<() => void>} */
  const teardown = [];

  for (const entry of entries) {
    const { callout } = entry;
    // Mascot → OPEN the active blurb (never closes it; the X is the only close).
    const mascot = callout.querySelector('[data-callout-mascot]');
    // The mascot TOGGLES the active blurb by default — it's the only affordance
    // that's always on screen, so it has to be able to bring a blurb back.
    // data-callout-mascot-action="open" makes it open-only, for a blurb carrying
    // its own controls where a stray click shouldn't dismiss them.
    const openOnly = callout.dataset.calloutMascotAction === 'open';
    const onMascot = () => {
      // Manual: her mascot is on screen whenever she has been summoned, so a
      // click means "show me that note again" (or toggle it, if the host has
      // not asked for open-only).
      if (entry.manual) {
        entry.dismissed = openOnly ? false : !entry.dismissed;
        render();
        return;
      }
      if (!centred) return;
      centred.dismissed = openOnly ? false : !centred.dismissed;
      render();
    };
    mascot?.addEventListener('click', onMascot);
    if (mascot) teardown.push(() => mascot.removeEventListener('click', onMascot));

    // X → close the current blurb until you scroll to a different section.
    const close = callout.querySelector('[data-callout-close]');
    const onClose = (event) => {
      event.stopPropagation();
      // Closes the NOTE, not the messenger — for a manual callout she stays
      // parked so the visitor can call the note back with a click.
      if (entry.manual) {
        entry.dismissed = true;
      } else if (centred) {
        centred.dismissed = true;
      }
      render();
    };
    close?.addEventListener('click', onClose);
    if (close) teardown.push(() => close.removeEventListener('click', onClose));
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      checkGates();
      update();
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  teardown.push(() => window.removeEventListener('scroll', onScroll));
  teardown.push(() => window.removeEventListener('resize', onScroll));

  checkGates();
  update();

  /** Resolve open()/close() targets: an element, a `data-callout-id`, a CSS
   *  selector, or nothing at all when the page has exactly one callout. */
  const resolve = (target) => {
    if (!target) return entries.length === 1 ? entries[0] : null;
    if (target instanceof Element) {
      return entries.find((e) => e.callout === target) ?? null;
    }
    return (
      entries.find((e) => e.id === target) ??
      entries.find((e) => e.callout.matches(target)) ??
      null
    );
  };

  const clearTimers = (entry) => {
    clearTimeout(entry.autoCloseTimer);
    clearTimeout(entry.exitTimer);
    entry.autoCloseTimer = null;
    entry.exitTimer = null;
  };

  /** How long `.is-leaving` stays on before the callout is actually hidden —
   *  the window a host has to animate the exit. 0 disables the phase. */
  const exitMs = options.exitMs ?? 0;

  const closeEntry = (entry, immediate) => {
    if (!entry) return;
    clearTimers(entry);
    if (!entry.forced) return;

    const finish = () => {
      entry.exitTimer = null;
      entry.callout.classList.remove('is-leaving');
      entry.forced = false;
      render();
    };

    if (immediate || !exitMs) {
      finish();
      return;
    }
    // Hold the callout on screen, flagged, so the host's exit animation (on
    // mobile: Arrow dipping back down off the bottom) can play out before the
    // element is pulled. Re-opening mid-exit cancels this via clearTimers.
    entry.callout.classList.add('is-leaving');
    entry.exitTimer = setTimeout(finish, exitMs);
  };

  return {
    refresh: onScroll,

    /**
     * Open a manual callout, optionally replacing its text.
     * @param {string|HTMLElement} [target]  data-callout-id, selector, or element
     * @param {string} [text]                blurb copy for this appearance
     * @param {{ autoCloseMs?: number }} [opts]  auto-dismiss after N ms
     */
    open(target, text, opts = {}) {
      const entry = resolve(target);
      if (!entry) return;
      clearTimers(entry);
      entry.callout.classList.remove('is-leaving');

      if (typeof text === 'string') {
        const el = entry.callout.querySelector('[data-callout-text], .arrow-callout__text');
        if (el) el.textContent = text;
      }

      entry.forced = true;
      entry.dismissed = false;
      render();

      // The timer closes the NOTE, not the messenger — the same thing the X
      // does. It used to call closeEntry, which clears `forced` and takes her
      // off the screen entirely, so on mobile she delivered a line and then
      // vanished: the visitor looked up from the field she was talking about
      // and there was nobody there. Leaving her standing means the note can be
      // called back with a click, and she is where you last saw her.
      if (opts.autoCloseMs > 0) {
        entry.autoCloseTimer = setTimeout(() => {
          entry.autoCloseTimer = null;
          entry.dismissed = true;
          render();
        }, opts.autoCloseMs);
      }
    },

    /**
     * Bring a manual callout on screen with its blurb CLOSED.
     *
     * The third of the three states render() already describes: present, but
     * not talking. `open()` cannot express it, because it clears `dismissed`
     * on the way past — so a host that wanted the mascot without the note had
     * to open and immediately close her, which flashes the blurb for a frame
     * and fires onOpen/onClose for something the visitor never saw.
     *
     * Used for a mascot that should be standing by before she has anything to
     * say: on the contact form she comes up as soon as someone starts typing,
     * and the bubble appears later, only when there is a message for it.
     *
     * @param {string|HTMLElement} [target]  data-callout-id, selector, or element
     */
    summon(target) {
      const entry = resolve(target);
      if (!entry) return;
      clearTimers(entry);
      entry.callout.classList.remove('is-leaving');
      entry.forced = true;
      entry.dismissed = true;
      render();
    },

    /** @param {string|HTMLElement} [target] @param {{immediate?: boolean}} [opts] */
    close(target, opts = {}) {
      closeEntry(resolve(target), opts.immediate === true);
    },

    /** @param {string|HTMLElement} [target] */
    isOpen(target) {
      const entry = resolve(target);
      return entry ? entry.callout.classList.contains('is-blurb-open') : false;
    },

    destroy() {
      for (const fn of teardown) fn();
      for (const entry of entries) {
        clearTimers(entry);
        const { callout, home } = entry;
        callout.classList.remove('is-blurb-open', 'is-active', 'is-leaving');
        // Put portaled callouts back, so a re-init (SPA route change, HMR) finds
        // them in their section rather than orphaned on <body>.
        if (home?.parent) home.parent.insertBefore(callout, home.next);
      }
    },
  };
}

/**
 * Park an anchored callout at the bottom of the FIRST viewport, inside a taller
 * positioned ancestor (e.g. a hero that is taller than the screen and pinned).
 * Sets `top` in pixels and keeps it correct across resizes.
 *
 * @param {HTMLElement} callout  a `.arrow-callout--anchored` element
 * @param {number} [gapRatio=0.02]  gap below it, as a fraction of viewport height
 * @returns {() => void} teardown
 */
export function anchorToFirstViewport(callout, gapRatio = 0.02) {
  const place = () => {
    const gap = window.innerHeight * gapRatio;
    callout.style.top = `${window.innerHeight - callout.offsetHeight - gap}px`;
  };
  place();
  window.addEventListener('resize', place, { passive: true });
  return () => window.removeEventListener('resize', place);
}

export default initArrowCallouts;
