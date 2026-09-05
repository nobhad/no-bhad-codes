/**
 * ===============================================
 * NAVIGATION MODULE - UPDATED WITH ROUTING
 * ===============================================
 * @file src/modules/navigation.ts
 * @extends BaseModule
 *
 * Enhanced navigation module with client-side routing support.
 * Handles menu animations, theme switching, and route-aware navigation.
 *
 * Event listeners are tracked via this.addEventListener() for automatic cleanup.
 */

import { BaseModule } from '../core/base';
import { appState } from '../../core/state';
import type { RouterService } from '../../services/router-service';
import type { DataService } from '../../services/data-service';
import { SubmenuModule } from './submenu';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../../types/modules';
import { createLogger } from '../../utils/logger';

const logger = createLogger('NavigationModule');
import { pulseGlow } from '../../utils/gsap-utilities';

/** Slack for sub-pixel scroll offsets, so "at top" is not defeated by 0.5px. */
const HEADER_TOP_EPSILON = 2;

export interface NavigationModuleOptions extends ModuleOptions {
  routerService?: RouterService;
  dataService?: DataService;
}

/**
 * Accessible names for the menu toggle, keyed by open state. These must stay
 * word-for-word identical to the visible label the button shows in each state
 * (the "Menu" / "Close" pair in .menu-button-text) — WCAG 2.5.3 Label in Name
 * requires the visible label to be contained in the accessible name, so speech
 * input users can activate the control by saying what they see.
 */
// Slightly past the 0.3s exit tweens, so the timeline wins when it works.
const CLOSE_SETTLE_MS = 400;

const MENU_TOGGLE_LABELS = { closed: 'Menu', open: 'Close' } as const;

/**
 * Is this [data-menu-toggle] element actually a control?
 *
 * The selector matches two very different things: the header's <button>, and
 * .overlay, which is a bare <div> backdrop that closes the menu when clicked.
 * Button ARIA — aria-expanded, aria-controls, aria-label — is only valid on
 * something with a button role, so it belongs on the first and not the second.
 */
function isMenuControl(el: HTMLElement): boolean {
  return el.tagName === 'BUTTON' || el.getAttribute('role') === 'button';
}

interface NavigationItem {
  id: string;
  text?: string;
  title?: string;
  href?: string;
  path?: string;
  eyebrow?: string;
  disabled?: boolean;
  comingSoon?: boolean;
}

interface WindowNavigationData {
  menuItems?: NavigationItem[];
}

export class NavigationModule extends BaseModule {
  private headerScrollCleanup: (() => void) | null = null;
  // Navigation elements
  private nav: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private menuToggles: NodeListOf<Element> | null = null;
  private menuLinks: NodeListOf<Element> | null = null;
  private bgPanels: NodeListOf<Element> | null = null;
  private menuButtonTexts: NodeListOf<Element> | null = null;
  private logoLink: HTMLElement | null = null;

  // Animation timelines
  private mainTimeline: gsap.core.Timeline | null = null;

  // State subscriptions
  /** Timer that guarantees the closed state if the exit timeline stalls. */
  private closeFallback: number | null = null;

  private unsubscribeNav?: () => void;

  // Touch device detection
  private isTouchDevice: boolean = false;
  private activeTouchLink: Element | null = null;

  // Services
  private routerService: RouterService | null = null;
  private dataService: DataService | null = null;
  private submenuModule: SubmenuModule | null = null;

  // Store options for later use
  private options: NavigationModuleOptions;

  constructor(options: NavigationModuleOptions = {}) {
    super('NavigationModule', options);

    this.options = options;
    this.routerService = options.routerService || null;
    this.dataService = options.dataService || null;
  }

  protected override async onInit(): Promise<void> {
    this.log('Starting initialization...');

    // Detect touch device
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.log('Touch device:', this.isTouchDevice);

    await this.cacheElements();
    this.log('Elements cached, RouterService:', !!this.routerService);
    this.setupEventListeners();
    this.setupHeaderScrollState();
    this.setupStateSubscriptions();
    this.setupAnimations();
    this.setupRoutes();
    await this.loadNavigationData();

    // Initialize submenu functionality
    this.submenuModule = new SubmenuModule({ debug: this.options.debug || false });
    await this.submenuModule.init();
    this.log('Initialization complete');
  }

  /**
   * Show the fixed header only while the reader is at the top of the page.
   *
   * The header floats over the content rather than sitting above it, which
   * reads fine at the top — the tile's padding leaves room for it — but once
   * scrolled it sits on top of whatever happens to be passing underneath.
   * Refreshing part-way down a case study makes that obvious, because the page
   * restores its scroll position and the header lands mid-paragraph.
   *
   * Scroll is listened for in the CAPTURE phase because scroll events do not
   * bubble: the map tiles are the scroll containers, not the window, so a
   * listener bound to window would never fire for them. Capture sees them all,
   * and the same handler still covers documents that scroll normally.
   */
  private setupHeaderScrollState(): void {
    const header = document.querySelector('.header') as HTMLElement | null;
    if (!header) {
      return;
    }

    const sync = () => {
      // The active scroller is whichever tile is on screen; fall back to the
      // document for pages that scroll normally.
      const active = document.querySelector('[data-map-tile]:not([hidden])');
      const tileTop = active ? active.scrollTop : 0;
      const docTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      const detail = document.getElementById('project-detail');
      const detailTop = detail ? detail.scrollTop : 0;
      const atTop = Math.max(tileTop, docTop, detailTop) <= HEADER_TOP_EPSILON;
      header.classList.toggle('header--scrolled', !atTop);
    };

    // Capture phase, and passive: this never calls preventDefault.
    document.addEventListener('scroll', sync, { capture: true, passive: true });
    window.addEventListener('resize', sync, { passive: true });
    // Run once so a restored scroll position is reflected on first paint
    // rather than only after the reader moves.
    sync();
    this.headerScrollCleanup = () => {
      document.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }

  /**
   * Cache all navigation elements
   */
  private async cacheElements(): Promise<void> {
    this.nav = this.getElement('nav', '[data-nav]', false) as HTMLElement | null;
    this.overlay = this.getElement('overlay', '.overlay', false) as HTMLElement | null;
    this.menuToggles = this.getElements('menuToggles', '[data-menu-toggle]', false);
    this.menuLinks = this.getElements('menuLinks', '.menu-link', false);
    this.bgPanels = this.getElements('bgPanels', '.bg-panel', false);
    this.menuButtonTexts = this.getElements('menuButtonTexts', '.menu-button-text p', false);
    this.logoLink = this.getElement('logoLink', '.nav-logo-row', false) as HTMLElement | null;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Menu toggle buttons - add accessibility attributes
    if (this.menuToggles) {
      this.menuToggles.forEach((toggle) => {
        const toggleEl = toggle as HTMLElement;

        // Only real buttons get the button ARIA. [data-menu-toggle] also
        // matches .overlay — a bare div backdrop — and aria-expanded,
        // aria-controls and aria-label are all invalid on a div with no role,
        // so labelling it announced a second, phantom menu button and failed
        // three axe rules at once. The overlay still closes the menu on click;
        // it just no longer claims to be a control.
        if (!isMenuControl(toggleEl)) {return;}

        // Add aria-label if not present
        if (!toggleEl.hasAttribute('aria-label')) {
          toggleEl.setAttribute('aria-label', 'Toggle navigation menu');
        }

        // Add aria-expanded state
        if (!toggleEl.hasAttribute('aria-expanded')) {
          toggleEl.setAttribute('aria-expanded', 'false');
        }

        // Point aria-controls at the nav, and only if the nav can actually be
        // referenced. The old fallback wrote the literal 'main-nav' whether or
        // not anything carried that id, which is a dangling reference — worse
        // than no attribute, because assistive tech announces a relationship
        // that goes nowhere.
        if (this.nav?.id && !toggleEl.hasAttribute('aria-controls')) {
          toggleEl.setAttribute('aria-controls', this.nav.id);
        }
      });

      // Click handling is separate from the ARIA above, because the overlay
      // needs the click and not the ARIA.
      this.menuToggles.forEach((toggle) => {
        this.addEventListener(toggle as Element, 'click', () => {
          this.toggleMenu();
        });
      });
    }

    // Menu links - only handle submenu toggles and close menu on valid link clicks
    if (this.menuLinks) {
      this.log('Setting up click handlers for', this.menuLinks.length, 'menu links');

      // Setup touch handling for mobile - tap once to animate, tap again to navigate
      if (this.isTouchDevice) {
        this.setupTouchHandlers();
      }

      this.menuLinks.forEach((link) => {
        const linkHref = (link as HTMLAnchorElement).getAttribute('href');
        this.addEventListener(link as Element, 'click', (event: Event) => {
          // Handle submenu toggle links
          if ((link as Element).hasAttribute('data-submenu-toggle')) {
            return; // Let submenu module handle this
          }

          // Prevent disabled links from working
          if ((link as Element).classList.contains('disabled')) {
            event.preventDefault();
            return;
          }

          // For all other valid links, handle navigation
          const href = linkHref;
          if (href) {
            event.preventDefault();

            // On touch devices, show animation then navigate after delay
            // On desktop, navigate immediately after menu close starts
            const animationDelay = this.isTouchDevice ? 300 : 100;

            // Add touch-active class on mobile to trigger animation
            if (this.isTouchDevice) {
              this.setTouchActiveLink(link);
            }

            this.closeMenu();

            // Handle hash links (same-page navigation) with router
            if (href.startsWith('#')) {
              // Check if we're on the home page
              const currentPath = window.location.pathname;
              const isHomePage =
                currentPath === '/' || currentPath === '/index.html' || currentPath === '';

              this.log('Hash link clicked:', href, 'isHomePage:', isHomePage);

              // Delay to let animation play, then navigate
              setTimeout(() => {
                if (isHomePage) {
                  // If already on home page, navigate via router
                  if (this.routerService) {
                    this.routerService.navigate(href, { smooth: true });
                  } else {
                    // Fallback: scroll directly to element
                    // Handle hashes: #/about -> about
                    const targetId = href.replace('#/', '').replace('#', '');
                    const targetElement =
                      document.getElementById(targetId) ||
                      document.querySelector(`.${CSS.escape(targetId)}-section`);
                    if (targetElement) {
                      targetElement.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                } else {
                  // If on another page, navigate to home page with hash
                  window.location.href = `/${href}`;
                }
              }, animationDelay);
            } else {
              // For non-hash links, delay then navigate
              setTimeout(() => {
                window.location.href = href;
              }, animationDelay);
            }
          }
        });
      });
    }

    // Overlay click to close
    if (this.overlay) {
      this.addEventListener(this.overlay, 'click', () => {
        this.closeMenu();
      });
    }

    // Keyboard support (tracked for cleanup)
    this.addEventListener(document, 'keydown', (event: Event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === 'Escape' && appState.getState().navOpen) {
        this.closeMenu();
      }
    });

    // Logo link - always force a fresh load so the intro animation
    // (coyote paw entrance) replays. In-page hash-change wouldn't replay
    // the intro because the SPA stays mounted; only a full reload triggers
    // the first-paint inline script that resets intro-loading state.
    if (this.logoLink) {
      this.addEventListener(this.logoLink, 'click', (event: Event) => {
        event.preventDefault();
        // Point at the intro route, then force a real reload. A hash-only
        // change (e.g. from #/projects, where the path is already "/") keeps
        // the SPA mounted and never re-runs the first-paint intro script, so
        // the coyote-paw entrance wouldn't replay without this explicit reload.
        window.location.href = '/#/';
        window.location.reload();
      });
    }
  }

  /**
   * Setup state subscriptions
   */
  private setupStateSubscriptions(): void {
    this.unsubscribeNav = appState.subscribeToProperty('navOpen', (isOpen) => {
      if (isOpen) {
        this.openMenuAnimation();
      } else {
        this.closeMenuAnimation();
      }
    });
  }

  /**
   * Setup GSAP animations
   */
  private setupAnimations(): void {
    if (!this.nav) {
      return;
    }

    // Create main timeline
    this.mainTimeline = gsap.timeline({ paused: true });

    // Visibility is owned by `.nav` / `.nav[data-nav="open"]` in nav-base.css.
    // It used to also be set inline here and in both timelines, and the two
    // disagreed: the opening timeline's write never landed, so the inline
    // `none` from this line outlived every open and the menu toggled
    // data-nav without ever appearing.

    // Set fade targets (social links) to hidden initially
    const fadeTargets = this.nav.querySelectorAll('[data-menu-fade]');
    gsap.set(fadeTargets, { autoAlpha: 0 });

    this.log('Animations initialized');
  }

  /**
   * Toggle menu state
   */
  private toggleMenu(): void {
    const currentState = appState.getState().navOpen;
    const newState = !currentState;
    appState.setState({ navOpen: newState });

    // Update aria-expanded on all toggle buttons for accessibility, and keep
    // the accessible name in step with the visible "Menu" / "Close" label.
    if (this.menuToggles) {
      this.menuToggles.forEach((toggle) => {
        // Same reason as in setupEventListeners: the overlay is in this list
        // for its click handler, not because it is a button.
        if (!isMenuControl(toggle as HTMLElement)) {return;}
        toggle.setAttribute('aria-expanded', String(newState));
        toggle.setAttribute(
          'aria-label',
          newState ? MENU_TOGGLE_LABELS.open : MENU_TOGGLE_LABELS.closed
        );
      });
    }
  }

  /**
   * Open menu with animation
   */
  private openMenuAnimation(): void {
    if (!this.nav || !this.mainTimeline) {
      return;
    }

    this.log('Opening menu');

    // Set nav state
    this.nav.setAttribute('data-nav', 'open');
    document.body.classList.add('nav-open');
    document.body.style.overflow = 'hidden';

    // Get portal button for mobile animation
    const portalButton = document.querySelector('.portal-button') as HTMLElement;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;

    // Get fade targets (social links section)
    const fadeTargets = this.nav.querySelectorAll('[data-menu-fade]');

    // Create opening animation exactly like working version 9.0
    const tl = gsap.timeline();

    // Faster opening sequence
    tl.set(document.querySelector('.menu'), { xPercent: 0 })
      // Hide fade targets initially (social links container)
      .set(fadeTargets, { autoAlpha: 0 })
      .fromTo(
        this.menuButtonTexts,
        { yPercent: 0 },
        { yPercent: -100, stagger: 0.15, duration: 0.5 }
      )
      .fromTo(
        document.querySelector('.menu-button-icon'),
        { rotation: 0 },
        { rotation: 45, duration: 0.5 },
        '<'
      )
      .fromTo(this.overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, '<')
      .fromTo(this.bgPanels, { xPercent: 101 }, { xPercent: 0, stagger: 0.08, duration: 0.4 }, '<')
      .fromTo(
        this.menuLinks,
        { yPercent: 140, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, stagger: 0.04, duration: 0.5 },
        '<+=0.25'
      )
      // Animate social links container after menu links
      .to(fadeTargets, { autoAlpha: 1, duration: 0.3 }, '<+=0.15');

    // On mobile, show portal button after panels pass (at 0.25s)
    if (isMobile && portalButton) {
      tl.to(
        portalButton,
        {
          opacity: 1,
          visibility: 'visible',
          pointerEvents: 'auto',
          duration: 0.2,
          ease: 'power2.out'
        },
        0.25
      );
    }
  }

  /**
   * Close menu with animation
   */
  private closeMenuAnimation(): void {
    if (!this.nav) {
      return;
    }

    this.log('Closing menu');

    // Hide portal button immediately when closing (on mobile)
    document.body.classList.remove('nav-open');
    const portalButton = document.querySelector('.portal-button') as HTMLElement;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;

    if (isMobile && portalButton) {
      gsap.set(portalButton, {
        opacity: 0,
        visibility: 'hidden',
        pointerEvents: 'none'
      });
    }

    // Get fade targets (social links section)
    const fadeTargets = this.nav.querySelectorAll('[data-menu-fade]');

    // Closing the menu is what returns data-nav to "closed", and that
    // attribute is what CSS uses to hide it. Landing it only in onComplete
    // makes the exit depend on the timeline finishing — and this one is not
    // reliably completing, which leaves the menu open with no way to shut
    // it. Guarded with a timer matching the animation so the attribute lands
    // either way; whichever runs first wins and the other is a no-op.
    const settle = (): void => {
      if (!this.nav) {
        return;
      }
      if (this.nav.getAttribute('data-nav') === 'closed') {
        return;
      }
      this.nav.setAttribute('data-nav', 'closed');
      document.body.style.overflow = '';
    };

    if (this.closeFallback !== null) {
      clearTimeout(this.closeFallback);
    }
    this.closeFallback = window.setTimeout(settle, CLOSE_SETTLE_MS);

    const tl = gsap.timeline({ onComplete: settle });

    // Faster closing sequence - hide fade targets immediately
    tl.to(fadeTargets, { autoAlpha: 0, duration: 0.15 }, 0)
      .to(this.overlay, { autoAlpha: 0, duration: 0.3 }, '<')
      .to(document.querySelector('.menu'), { xPercent: 120, duration: 0.3 }, '<')
      .to(this.menuButtonTexts, { yPercent: 0, duration: 0.3 }, '<')
      .to(document.querySelector('.menu-button-icon'), { rotation: 0, duration: 0.3 }, '<');
  }

  /**
   * Setup routes with router service
   * Uses hash routing: #/, #/about, #/contact
   */
  private setupRoutes(): void {
    if (!this.routerService) {
      return;
    }

    const routes = [
      {
        path: '/',
        section: 'intro',
        title: 'No Bhad Codes',
        onEnter: () => this.onSectionEnter('home')
      },
      {
        path: '#/',
        section: 'intro',
        title: 'No Bhad Codes',
        onEnter: () => this.onSectionEnter('home')
      },
      {
        path: '/projects',
        section: 'portfolio',
        title: 'Portfolio - No Bhad Codes',
        onEnter: () => this.onSectionEnter('portfolio')
      },
      {
        path: '/client',
        section: 'client',
        title: 'Client Portal - No Bhad Codes',
        onEnter: () => this.onSectionEnter('client')
      },
      {
        path: '#/about',
        section: 'about',
        title: 'About - No Bhad Codes',
        onEnter: () => this.onSectionEnter('about')
      },
      {
        path: '#/contact',
        section: 'contact',
        title: 'Contact - No Bhad Codes',
        onEnter: () => this.onSectionEnter('contact')
      }
    ];

    this.routerService.addRoutes(routes);
    this.log('Routes registered with router service');
  }

  /**
   * Load navigation data from data service
   */
  private async loadNavigationData(): Promise<void> {
    try {
      // Load navigation data dynamically from data service or template data
      let navigationItems = [];

      if (this.dataService) {
        // Try to get navigation data from data service
        try {
          const navigationData = this.dataService.getNavigation();
          navigationItems = navigationData?.main || [];
        } catch {
          // DataService not initialized, will use fallback
        }
      }

      // Fallback: try to get from window global if available (from EJS template)
      if (navigationItems.length === 0 && typeof window !== 'undefined') {
        const windowData = (window as unknown as { NAVIGATION_DATA?: WindowNavigationData })
          .NAVIGATION_DATA;
        if (windowData?.menuItems) {
          navigationItems = windowData.menuItems;
        }
      }

      // Final fallback: get from DOM data attributes if available
      if (navigationItems.length === 0) {
        const navElement = document.querySelector('[data-navigation]');
        if (navElement) {
          const navData = navElement.getAttribute('data-navigation');
          if (navData) {
            try {
              const parsed = JSON.parse(navData);
              navigationItems = parsed.menuItems || [];
            } catch (_e) {
              this.warn('Failed to parse navigation data from DOM');
            }
          }
        }
      }

      // Ultimate fallback, used only when no navigation data could be loaded.
      // It still described a site where the portfolio was unbuilt — disabled,
      // badged "Coming Soon", pointing at '#', and with no portal at all — so
      // any page that reached this path advertised work that has been live for
      // months. Mirrors the menu in index.html.
      if (navigationItems.length === 0) {
        navigationItems = [
          { id: 'home', text: 'home', href: '#/', eyebrow: '00' },
          { id: 'about', text: 'about', href: '#/about', eyebrow: '01' },
          { id: 'contact', text: 'contact', href: '#/contact', eyebrow: '02' },
          { id: 'projects', text: 'projects', href: '#/projects', eyebrow: '03' },
          { id: 'portal', text: 'portal', href: '#/portal', eyebrow: '04' }
        ];
      }

      this.updateNavigationDOM(navigationItems);
      this.detectCurrentPage();
      this.watchRouteForActiveLink();
    } catch (error) {
      logger.error('Error loading navigation data:', error);
      // Continue with empty navigation rather than crashing
      this.detectCurrentPage();
    }
  }

  /**
   * Update navigation DOM with data
   */
  private updateNavigationDOM(navigationItems: NavigationItem[]): void {
    if (!this.menuLinks) {
      return;
    }

    navigationItems.forEach((item, index) => {
      const menuLink = this.menuLinks?.[index] as HTMLAnchorElement;
      if (menuLink) {
        const heading = menuLink.querySelector('.menu-link-heading');
        const eyebrow = menuLink.querySelector('.eyebrow');

        // Handle both data formats: {text, href} and {title, path}
        const itemText = item.text || item.title || '';
        const itemHref = item.href || item.path || '#';

        if (heading) {
          heading.textContent = itemText;
          heading.setAttribute('data-text', itemText);
        }

        if (eyebrow) {
          eyebrow.textContent = item.eyebrow || '';
        }

        // Update href for routing
        menuLink.setAttribute('href', itemHref);

        // Handle disabled state
        if (item.disabled) {
          menuLink.classList.add('disabled');
          menuLink.setAttribute('href', '#');
          menuLink.setAttribute('aria-disabled', 'true');
        } else {
          menuLink.classList.remove('disabled');
          menuLink.removeAttribute('aria-disabled');
        }

        // Handle coming soon banner
        const comingSoonBanner = menuLink.querySelector('.coming-soon-banner');
        if (item.comingSoon) {
          if (!comingSoonBanner) {
            const banner = document.createElement('div');
            banner.className = 'coming-soon-banner';
            banner.textContent = 'Coming Soon';
            menuLink.appendChild(banner);
            // Apply GSAP pulse-glow animation (replaces CSS keyframe)
            pulseGlow(banner);
          }
        } else if (comingSoonBanner) {
          comingSoonBanner.remove();
        }
      }
    });
  }

  /**
   * Handle section enter events
   */
  private onSectionEnter(sectionName: string): void {
    this.log(`Entered section: ${sectionName}`);
    this.dispatchEvent('section-entered', { sectionName });
  }

  /**
   * Setup touch event handlers for mobile tap-to-animate behavior
   */
  private setupTouchHandlers(): void {
    // Listen for taps outside menu links to clear touch-active state (tracked for cleanup)
    this.addEventListener(document, 'touchstart', (event: Event) => {
      if (!this.activeTouchLink) {
        return;
      }

      const touchEvent = event as TouchEvent;
      const target = touchEvent.target as Element;
      const isMenuLink = target.closest('.menu-link');

      // If tapping outside any menu link, clear the active state
      if (!isMenuLink) {
        this.clearTouchActiveLink();
      }
    });

    this.log('Touch handlers initialized');
  }

  /**
   * Set a menu link as touch-active (shows hover animation)
   */
  private setTouchActiveLink(link: Element): void {
    // Clear any previously active link
    this.clearTouchActiveLink();

    // Set new active link
    link.classList.add('touch-active');
    this.activeTouchLink = link;
  }

  /**
   * Clear touch-active state from all links
   */
  private clearTouchActiveLink(): void {
    if (this.activeTouchLink) {
      this.activeTouchLink.classList.remove('touch-active');
      this.activeTouchLink = null;
    }
  }

  /**
   * Close menu programmatically
   */
  private closeMenu(): void {
    // Close any open submenus first
    if (this.submenuModule) {
      this.submenuModule.closeAllSubmenus();
    }

    appState.setState({ navOpen: false });
  }

  /**
   * Detect current page and update active state
   */
  private detectCurrentPage(): void {
    if (!this.menuLinks) {
      return;
    }

    // The route lives in the hash, not the path. This compared hrefs against
    // window.location.pathname, which on a hash-routed SPA is always '/', so
    // nothing ever matched and no menu item was ever marked current. The
    // remaining path cases ('/projects', '/client') are addresses this site
    // stopped using when it moved to hash routes.
    const normalise = (value: string | null): string => {
      if (!value) {
        return '';
      }
      const hash = value.startsWith('#') ? value : value.slice(value.indexOf('#'));
      if (!hash || hash === '#' || hash === '#/') {
        return '#/';
      }
      return hash.startsWith('#/') ? hash : `#/${hash.slice(1)}`;
    };
    const current = normalise(window.location.hash || '#/');

    this.menuLinks.forEach((link) => {
      const linkElement = link as HTMLElement;
      const href = normalise((link as HTMLAnchorElement).getAttribute('href'));
      const isCurrent = href !== '' && href === current;
      linkElement.classList.toggle('active', isCurrent);
      if (isCurrent) {
        linkElement.setAttribute('aria-current', 'page');
      } else {
        linkElement.removeAttribute('aria-current');
      }
    });
  }

  /** Keep the highlight in step with the route. */
  private watchRouteForActiveLink(): void {
    window.addEventListener('hashchange', () => this.detectCurrentPage());
    window.addEventListener('page-changed', () => this.detectCurrentPage());
  }

  /**
   * Programmatically navigate to section
   * Uses hash routing: #/, #/about, #/contact
   */
  navigateToSection(sectionId: string): void {
    if (this.routerService) {
      // Use hash format
      const hash = sectionId === 'intro' || sectionId === 'home' ? '#/' : `#/${sectionId}`;
      this.routerService.navigate(hash);
    }
  }

  /**
   * Get current navigation state
   */
  getNavigationState() {
    return {
      isOpen: appState.getState().navOpen,
      currentRoute: this.routerService?.getCurrentRoute(),
      hasRouter: !!this.routerService
    };
  }

  /**
   * Cleanup on destroy
   */
  protected override async onDestroy(): Promise<void> {
    if (this.unsubscribeNav) {
      this.unsubscribeNav();
    }

    if (this.mainTimeline) {
      this.mainTimeline.kill();
    }

    // Cleanup submenu module
    if (this.submenuModule) {
      this.submenuModule.destroy();
      this.submenuModule = null;
    }

    // Reset body overflow
    document.body.style.overflow = '';
  }
}
