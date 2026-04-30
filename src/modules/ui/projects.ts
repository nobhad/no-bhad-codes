/**
 * ===============================================
 * PROJECTS MODULE
 * ===============================================
 * @file src/modules/ui/projects.ts
 *
 * Renders project cards in the projects section.
 * Shows WIP sign until at least 2 projects are fully documented.
 * Handles project detail page rendering and navigation.
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import { formatTextWithLineBreaks, escapeHtml } from '../../utils/format-utils';
import { tvSfx } from '../audio/tv-sfx';

// escapeHtml already encodes & < > " ' ` so it's safe for both element
// content and attribute values. Aliased for readability at call sites.
const escapeAttr = escapeHtml;

/**
 * Pick a semi-transparent veil color that contrasts the given hex text
 * color. Used by the tune-in panels so the per-card font color stays
 * readable against the bg image without needing per-card CSS overrides.
 *
 * Light text (white-ish) → dark veil. Dark text (black-ish) → light veil.
 * Threshold uses sRGB luma since we're optimizing for human readability.
 */
function contrastVeil(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return 'rgba(0, 0, 0, 0.45)';
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  // Rec. 709 luma — closer to perceived brightness than a flat average.
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.5 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.78)';
}
import { createLogger } from '../../utils/logger';

const logger = createLogger('ProjectsModule');

/**
 * Structured title-card data drives the TV "tune-in" sequence.
 * Lines in primary/secondary are rendered as separate <span>s so each
 * line can break independently (no <br> in JSON / no whitespace hacks).
 * Pt sizes are the design-spec point sizes from the source artwork; CSS
 * scales them via container queries so they shrink with the TV.
 */
interface TitleCardData {
  // Composed title card with text baked in — shown first, then fades to bg.
  composed: string;
  // Background-only version of the title card (no text) — shown beneath
  // panels for the rest of the case-study sequence.
  bg: string;
  // Per-card text color & layout spec, currently unused by the runtime
  // (composed image carries the rendered text). Kept in JSON for the
  // future HTML-overlay path so we can swap rendering modes later.
  color: string;
  primary: string[];
  primaryPt: number;
  secondary: string[];
  secondaryPt: number;
}

interface PortfolioProject {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  role: string;
  tools: string[];
  technologies?: string[];
  year: number;
  status: 'in-progress' | 'completed' | 'planned';
  heroImage: string;
  screenshots: string[];
  liveUrl?: string;
  repoUrl?: string;
  isDocumented: boolean;
  titleCard?: string | TitleCardData;
  duration?: string;
  challenge?: string;
  approach?: string;
  results?: string[];
  keyFeatures?: string[];
  // Optional TV-channel-preview overrides — condensed copy meant for the
  // in-TV case study. Each field falls back to its full counterpart when
  // not provided, so projects without curated TV copy still render.
  tv?: {
    description?: string;
    challenge?: string;
    approach?: string;
    results?: string[];
    keyFeatures?: string[];
  };
}

interface PortfolioData {
  projects: PortfolioProject[];
  categories: Array<{ id: string; name: string; count: number }>;
}

// Minimum documented projects required to show project list
const MIN_DOCUMENTED_PROJECTS = 2;

// View mode for the projects section. TV is the immersive default;
// list is the cards-grid escape hatch for visitors who want to skip
// the channel-guide flow. Persisted in localStorage so a returning
// visitor's choice survives reloads.
type ViewMode = 'tv' | 'list';
const VIEW_MODE_STORAGE_KEY = 'nbc:projects:viewMode';
const VIEW_MODE_DEFAULT: ViewMode = 'tv';
// View-mode cross-fade between TV and list containers (slower so the
// content swap feels like a real transition rather than a flicker).
const VIEW_TOGGLE_FADE_S = 0.25;

// Tune-in sequence timing & visual constants. Centralized so the pacing
// of the title card → Looney-Tunes-credit-card panel cycle can be tuned
// in one place. Each panel fades in, holds, then fades out as the next
// fades in (crossfade) — the outro panel is sticky as the terminal frame.
const TV_STATIC_FLASH_OPACITY = 0.85; // peak of the channel-change burst
const TV_STATIC_GRAIN_OPACITY = 0.18; // residual grain after the burst
const TV_BG_FLASH_S = 0.2;            // beat per-project bg holds alone before composed card fades in
const TV_BLANK_FLASH_S = 0.15;        // blank title-card flash between channels (the "between channels" void)
const TV_TITLE_HOLD_S = 1.4;          // beat the composed title card holds
const TV_DOCK_DURATION_S = 0.55;      // composed → bg crossfade duration
// Per-panel hold time. Paragraphs need real read time; short panels
// (tagline, details, lists) feel sluggish if held that long.
const TV_PANEL_HOLD_S: Record<string, number> = {
  tagline: 4.0,
  details: 5.0,
  intro: 9.0,
  challenge: 9.0,
  approach: 9.0,
  features: 7.0,
  results: 7.0,
  tools: 5.0
};
const TV_SECTION_PAUSE_S_DEFAULT = 6.0; // fallback for any unmapped panel key
const TV_MOBILE_SCROLL_HOLD_MULTIPLIER = 2.2; // mobile prose panels hold 2.2× longer so the bottom-to-top scroll reads at a comfortable pace
const TV_TEXT_SWAP_BEAT_S = 0.35;     // empty beat between title fade-out and first panel fade-in
const TV_TEXT_FADE_S = 0.45;          // panel fade-in / fade-out duration
const TV_HEADING_FLASH_S = 0.35;      // section heading scale-flash duration (no-span fallback)
const TV_HEADING_HOLD_S = 2.0;        // beat heading sits alone before body fades in
const TV_WORD_PULSE_S = 0.4;          // per-word pop-in duration (tagline + Challenge/Approach headings)
const TV_WORD_STAGGER_S = 0.18;       // delay between each word's pop

// Arrow SVG for project cards
const ARROW_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 12h14"/>
  <path d="m12 5 7 7-7 7"/>
</svg>
`;

// External link icon
const EXTERNAL_LINK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
  <polyline points="15 3 21 3 21 9"/>
  <line x1="10" y1="14" x2="21" y2="3"/>
</svg>
`;

// GitHub icon
const GITHUB_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
  <path d="M9 18c-4.51 2-5-2-7-2"/>
</svg>
`;

// View-toggle icons — Lucide tv & list. Inline so they pick up
// currentColor from the active/inactive button state without a
// separate stylesheet for icon fills.
const TV_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="m17 2-5 5-5-5"/>
  <rect width="20" height="15" x="2" y="7" rx="2"/>
</svg>
`;

const LIST_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 5h.01"/>
  <path d="M3 12h.01"/>
  <path d="M3 19h.01"/>
  <path d="M8 5h13"/>
  <path d="M8 12h13"/>
  <path d="M8 19h13"/>
</svg>
`;

export class ProjectsModule extends BaseModule {
  private projectsSection: HTMLElement | null = null;
  private projectsContent: HTMLElement | null = null;
  private projectDetailSection: HTMLElement | null = null;
  private portfolioData: PortfolioData | null = null;
  private currentProjectSlug: string | null = null;

  // Tune-in sequence state.
  //   tuneInTimeline   — entrance (static + bg swap + composed-card fade)
  //   tuneInScrollTween — looping end-credits scroll of the panel column
  //   activeTuneInSlug — which channel is currently playing (suppresses
  //                      restart on repeat clicks of the same row)
  private tuneInTimeline: gsap.core.Timeline | null = null;
  private tuneInScrollTween: gsap.core.Timeline | null = null;
  private activeTuneInSlug: string | null = null;

  // TV Guide channel-row ticker — slow continuous scroll of the rows in
  // the bottom half of the channel-list, mirroring the Prevue Guide.
  // Rows are rendered twice in the DOM; tween translates by exactly half
  // the track height then snaps to 0 for a seamless loop.
  private channelTickerTween: gsap.core.Tween | null = null;

  // User's chosen view mode for the projects section. Read from
  // localStorage during onInit so the toggle paints with correct
  // aria-pressed state and the matching view shows on first frame.
  private viewMode: ViewMode = VIEW_MODE_DEFAULT;

  constructor() {
    super('ProjectsModule', { debug: false });
  }

  protected async onInit(): Promise<void> {
    this.projectsSection = document.getElementById('projects');
    this.projectDetailSection = document.getElementById('project-detail');

    if (!this.projectsSection) {
      this.warn('Projects section not found');
      return;
    }

    this.projectsContent = this.projectsSection.querySelector('.projects-content');
    if (!this.projectsContent) {
      this.warn('Projects content not found');
      return;
    }

    // Load portfolio data
    await this.loadPortfolioData();

    // Restore the user's preferred view mode before first paint so
    // the toggle buttons render with correct aria-pressed state and
    // the matching view (TV or cards) is the one we show.
    this.viewMode = this.readStoredViewMode();

    // Render projects or WIP sign
    this.render();

    // Set up back button handler
    this.setupBackButton();

    // Pre-render content on hash change so it's ready before the page animates in
    window.addEventListener('hashchange', this.handleHashChange.bind(this));

    // Listen for page-changed events (back-navigation cleanup, title reset)
    window.addEventListener('page-changed', this.handlePageChanged.bind(this) as EventListener);

    // Channel-surf the CRT TV. PageTransitionModule owns the index and
    // dispatches this with an explicit target channel so the TV display
    // and the navigation gateway never disagree about which project is
    // "current" for the boundary-exit logic.
    document.addEventListener('projects:set-tv-channel', ((event: CustomEvent) => {
      const index = event.detail?.index as number | undefined;
      // `cycle: true` means user-initiated channel change (wheel/keys/
      // CHANNEL button) — triggers the full tune-in. `cycle: false` (or
      // missing) means a passive sync (page entry, project-detail
      // carousel back-nav) that should only update the LED + row
      // highlight without flashing into a different channel.
      const cycle = event.detail?.cycle === true;
      if (typeof index === 'number') this.setTvChannel(index, { cycle });
    }) as EventListener);

    // Tune-in: keyboard Enter on the projects tile triggers this so the
    // TV's title-card pre-roll plays before navigation (matches the
    // row-click flow that already calls playTuneInSequence
    // directly).
    document.addEventListener('projects:tune-in', ((event: CustomEvent) => {
      const slug = event.detail?.slug as string | undefined;
      if (slug) void this.playTuneInSequence(slug);
    }) as EventListener);

    // Esc cancels an in-flight tune-in and returns to the channel guide.
    // Only fires when a tune-in is actually active so it doesn't fight
    // other Esc handlers (modals, menu, etc.) on the projects page.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.activeTuneInSlug !== null) {
        this.cancelTuneIn();
      }
    });

    // Check initial hash for project detail (on page load only)
    this.checkInitialHash();

    this.log('Initialized');
  }

  /**
   * Check initial hash on page load for project detail
   */
  private checkInitialHash(): void {
    const hash = window.location.hash;
    const projectMatch = hash.match(/^#\/projects\/(.+)$/);

    if (projectMatch) {
      const slug = projectMatch[1];
      // Initial deep-link render — entrance animation runs because there's
      // no slide transition to mask its absence.
      this.renderProjectDetailForSlug(slug, { fromNavigation: false });
    }
  }

  /**
   * Pre-render project detail content as soon as the hash changes,
   * before PageTransitionModule animates the page in.
   */
  private handleHashChange(): void {
    const hash = window.location.hash;
    const projectMatch = hash.match(/^#\/projects\/(.+)$/);
    if (projectMatch) {
      // Hash-driven navigation always rides on a slide transition, so skip
      // the inner-element fade-in entrance — the slide IS the entrance.
      this.renderProjectDetailForSlug(projectMatch[1], { fromNavigation: true });
    }
  }

  /**
   * Handle page-changed events from PageTransitionModule
   */
  private handlePageChanged(event: CustomEvent): void {
    const { to } = event.detail || {};

    if (to === 'projects') {
      // Returning to projects list — reset detail state and tear down any
      // in-flight tune-in so the user lands back on the channel guide.
      this.currentProjectSlug = null;
      document.title = 'Projects - No Bhad Codes';
      this.cancelTuneIn();
    }
  }

  /**
   * Set the toggle's display directly based on the active page id.
   * 'flex' on projects, 'none' everywhere else. Uses inline style so
   * it overrides the CSS default `display: none` baseline.
   */
  private syncToggleVisibility(activePage: string | null | undefined): void {
    const toggle = this.projectsSection?.querySelector('.projects-view-toggle') as HTMLElement | null;
    if (!toggle) return;
    toggle.style.display = activePage === 'projects' ? 'flex' : 'none';
  }

  /**
   * Render project detail content for a given slug
   * Does NOT manage page visibility - only content rendering
   */
  private renderProjectDetailForSlug(
    slug: string,
    options: { fromNavigation?: boolean } = {}
  ): void {
    if (!this.portfolioData || !this.projectDetailSection) return;

    const project = this.portfolioData.projects.find((p) => p.slug === slug);
    if (!project) {
      this.warn(`Project not found: ${slug}`);
      // Navigate back to projects list
      window.location.hash = '#/projects';
      return;
    }

    // Skip the drop-in entrance animation in two cases:
    //  1. Carousel between two project detail slugs (no need to re-enter)
    //  2. Any hash-driven navigation (the slide is the entrance — running
    //     the fade-in on inner elements at the same time makes the whole
    //     thing read as a fade rather than a slide)
    const isCarousel = this.currentProjectSlug !== null && this.currentProjectSlug !== slug;
    const skipEntrance = isCarousel || options.fromNavigation === true;

    this.currentProjectSlug = slug;

    // Populate project detail content
    this.renderProjectDetail(project, { skipEntrance });

    // Update page title
    document.title = `${project.title} - No Bhad Codes`;

    // Sync the TV channel index to the current detail slug so returning
    // to the projects tile (via vertical scroll, compass, back button,
    // or deep-link) shows the card the user was just reading. Fires a
    // CustomEvent on window that PageTransitionModule picks up to keep
    // its currentTvIndex in sync.
    const documented = this.portfolioData.projects.filter((p) => p.isDocumented);
    const idx = documented.findIndex((p) => p.slug === slug);
    if (idx >= 0) {
      window.dispatchEvent(
        new CustomEvent('projects:active-slug-changed', { detail: { index: idx } })
      );
    }
  }

  /**
   * Load portfolio data from JSON file
   */
  private async loadPortfolioData(): Promise<void> {
    try {
      const response = await fetch('/data/portfolio.json');
      if (!response.ok) {
        throw new Error(`Failed to load portfolio data: ${response.status}`);
      }
      this.portfolioData = await response.json();
    } catch (error) {
      logger.error('[ProjectsModule] Failed to load portfolio data:', error);
      this.portfolioData = { projects: [], categories: [] };
    }
  }

  /**
   * Render projects section based on documented project count
   */
  private render(): void {
    if (!this.projectsContent || !this.portfolioData) return;

    const documentedProjects = this.portfolioData.projects.filter((p) => p.isDocumented);
    const hasEnoughDocumented = documentedProjects.length >= MIN_DOCUMENTED_PROJECTS;

    if (hasEnoughDocumented) {
      this.renderProjectCards(documentedProjects);
      this.renderViewToggle();
      this.applyViewMode(this.viewMode);
    }
    // If not enough documented projects, keep the existing WIP sign
  }

  /**
   * Read the stored view-mode preference. Returns the default if the
   * value is missing, malformed, or storage is unavailable (private
   * mode / quota errors). Non-fatal — the in-memory default still
   * drives the current session.
   */
  private readStoredViewMode(): ViewMode {
    try {
      const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (stored === 'tv' || stored === 'list') return stored;
    } catch {
      // Storage may be unavailable (private mode, quota exceeded).
    }
    return VIEW_MODE_DEFAULT;
  }

  /**
   * Persist the user's view-mode choice. Swallows storage errors so
   * the toggle keeps working even when localStorage is blocked.
   */
  private persistViewMode(mode: ViewMode): void {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Same rationale as readStoredViewMode.
    }
  }

  /**
   * Build the segmented TV/list toggle and insert it as the first
   * child of .projects-content. The toggle is positioned absolutely
   * (CSS) at the section's top-right corner — visible only when the
   * projects section itself is visible. No JS visibility plumbing
   * required: section.page-hidden hides the section AND the toggle
   * inside it in one step, eliminating the cross-page leak that the
   * previous header-mounted approach suffered from. Idempotent:
   * a no-op if already inserted.
   */
  private renderViewToggle(): void {
    if (!this.projectsSection || !this.projectsContent) return;
    if (this.projectsSection.querySelector('.projects-view-toggle')) return;

    // Two-element structure: outer .projects-view-toggle is the
    // absolute-positioned anchor; inner __group is the bordered
    // segmented control. Mirrors the .portal-auth-toggle pattern in
    // nav-portal.css so the visual language matches the login
    // dropdown's segmented switch.
    const toggle = document.createElement('div');
    toggle.className = 'projects-view-toggle';
    toggle.innerHTML = `
      <div class="projects-view-toggle__group" role="group" aria-label="Project view mode">
        <button type="button"
                class="projects-view-toggle__btn"
                data-view="tv"
                aria-label="TV view"
                aria-pressed="${this.viewMode === 'tv'}">
          ${TV_ICON_SVG}
        </button>
        <button type="button"
                class="projects-view-toggle__btn"
                data-view="list"
                aria-label="List view"
                aria-pressed="${this.viewMode === 'list'}">
          ${LIST_ICON_SVG}
        </button>
      </div>
    `;

    // Insert as a direct child of .projects-section (NOT .projects-content).
    // page-transitions.css applies will-change to `section[data-page] > *`,
    // which makes any section-direct-child a containing block for fixed-
    // positioned descendants. Putting the toggle inside .projects-content
    // would anchor its position:fixed to the content box (which shifts
    // when view-mode swaps and isn't actually the viewport), causing the
    // toggle to drift on TV ↔ list switches and to "touch" the TV instead
    // of sitting at the viewport top. As a sibling of .projects-content,
    // the toggle's fixed positioning resolves up to the viewport because
    // no ancestor in its chain creates a fixed-containing-block.
    this.projectsSection.insertBefore(toggle, this.projectsContent);

    toggle.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const btn = target?.closest('[data-view]') as HTMLButtonElement | null;
      if (!btn) return;
      const next = btn.dataset.view;
      if (next !== 'tv' && next !== 'list') return;
      if (next === this.viewMode) return;
      this.setViewMode(next);
    });
  }

  /**
   * Switch view mode with a GSAP cross-fade between the outgoing and
   * incoming containers. Class flip happens at the midpoint so the
   * incoming element is still display:none during fade-out and the
   * outgoing element is back to display:none before fade-in starts —
   * prevents a brief frame where both would stack visually.
   */
  private setViewMode(mode: ViewMode): void {
    if (!this.projectsContent) return;
    if (mode === this.viewMode) return;

    const outgoing = this.getViewElement(this.viewMode);
    const incoming = this.getViewElementOrCreate(mode);

    this.viewMode = mode;
    this.persistViewMode(mode);

    if (!outgoing || !incoming) {
      this.applyViewMode(mode);
      return;
    }

    gsap.to(outgoing, {
      opacity: 0,
      duration: VIEW_TOGGLE_FADE_S,
      ease: 'power2.out',
      onComplete: () => {
        // Reset opacity on the now-hidden outgoing element so the
        // next time it becomes visible it isn't stuck at 0.
        gsap.set(outgoing, { clearProps: 'opacity' });
        this.applyViewMode(mode);
        gsap.fromTo(
          incoming,
          { opacity: 0 },
          { opacity: 1, duration: VIEW_TOGGLE_FADE_S, ease: 'power2.in' }
        );
      }
    });
  }

  /**
   * Apply the view-mode class to .projects-content and sync the
   * toggle's aria-pressed state. CSS class drives display of the TV
   * vs cards container. TV is created lazily on first switch into
   * tv mode if it isn't in the DOM yet.
   */
  private applyViewMode(mode: ViewMode): void {
    if (!this.projectsContent) return;

    if (mode === 'tv' && !this.projectsContent.querySelector('.crt-tv')) {
      this.renderCrtTv();
    }

    this.projectsContent.classList.toggle('is-view-tv', mode === 'tv');
    this.projectsContent.classList.toggle('is-view-list', mode === 'list');

    // Toggle lives in .projects-section (sibling of .projects-content) so
    // its position:fixed anchors to the viewport rather than to the
    // content box's will-change containing block.
    const toggle = this.projectsSection?.querySelector('.projects-view-toggle');
    if (toggle) {
      toggle.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
        btn.setAttribute('aria-pressed', btn.dataset.view === mode ? 'true' : 'false');
      });
    }
  }

  /**
   * Resolve the container element for a given view mode. Used by
   * setViewMode to pick the right node to fade.
   */
  private getViewElement(mode: ViewMode): HTMLElement | null {
    if (!this.projectsContent) return null;
    const selector = mode === 'tv' ? '.projects-tv-wrap' : '.work-half-wrapper';
    return this.projectsContent.querySelector(selector);
  }

  /**
   * Same as getViewElement but creates the TV first if switching to
   * tv mode and the TV isn't in the DOM yet (cards always exist
   * after renderProjectCards, so list mode never needs creation).
   */
  private getViewElementOrCreate(mode: ViewMode): HTMLElement | null {
    if (!this.projectsContent) return null;
    if (mode === 'tv' && !this.projectsContent.querySelector('.crt-tv')) {
      this.renderCrtTv();
    }
    return this.getViewElement(mode);
  }

  /**
   * Render project cards
   */
  private renderProjectCards(projects: PortfolioProject[]): void {
    if (!this.projectsContent) return;

    // Remove the WIP sign container if it exists
    const wipContainer = this.projectsContent.querySelector('.wip-sign-container');
    if (wipContainer) {
      wipContainer.remove();
    }

    // Find or create the work wrapper after the hr
    let workWrapper = this.projectsContent.querySelector('.work-half-wrapper');
    if (!workWrapper) {
      workWrapper = document.createElement('div');
      workWrapper.className = 'work-half-wrapper';
      this.projectsContent.appendChild(workWrapper);
    }

    // Clear existing content
    workWrapper.innerHTML = '';

    // Sort projects by year (newest first), then by featured
    const sortedProjects = [...projects].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return 0;
    });

    // Render each project card
    sortedProjects.forEach((project, index) => {
      const card = this.createProjectCard(project, index);
      workWrapper!.appendChild(card);
    });

    // Add click handlers
    this.attachCardListeners();

    // TV creation is deferred to applyViewMode() so a returning visitor
    // who chose list view doesn't pay for TV DOM/event setup until they
    // actually switch back. The cards stay in the DOM either way; CSS
    // (.is-view-tv / .is-view-list on .projects-content) decides which
    // container is visible.

    // GSAP staggered entrance animation for cards
    this.animateCardEntrance();

    // GSAP heading divider scale animation
    this.animateHeadingDivider();
  }

  /**
   * Render CRT TV component using actual PNG image. The TV is centered
   * in a single column and its screen displays the project list as a
   * channel-guide style text overlay (project title / category / year),
   * with the active channel highlighted.
   */
  private renderCrtTv(): void {
    if (!this.projectsContent) return;

    // Check if TV already exists
    if (this.projectsContent.querySelector('.crt-tv')) return;

    const workWrapper = this.projectsContent.querySelector('.work-half-wrapper');
    if (!workWrapper) return;

    // Card vs TV visibility is driven by .is-view-tv / .is-view-list
    // on .projects-content (see applyViewMode + projects.css). Cards
    // stay in the DOM either way so click handlers and tab order
    // remain resolvable when the user toggles back to list view.

    // Centered TV container. Single child of projects-content (heading +
    // hr stay above) so the TV lands in the middle of the section.
    const tvWrap = document.createElement('div');
    tvWrap.className = 'projects-tv-wrap';

    const tvHtml = `
      <div class="crt-tv">
        <div class="crt-tv__wrapper">
          <img class="crt-tv__screen-bg" src="/images/title-card_base-on.webp" alt="" data-screen-bg />
          <!-- Composed title-card (text baked in) sits at the same full
               TV-frame canvas as the bg below. Lives outside .crt-tv__screen
               because .crt-tv__screen is sized to the screen aperture only
               (72.8% wide × 70.4% tall) for the channel list / panels —
               putting the full-canvas composed image inside that box would
               stretch it into the aperture and misalign with the bg. -->
          <img class="crt-tv__image" src="" alt="Project preview" />
          <div class="crt-tv__screen">
            <div class="crt-tv__channel-list" data-channel-list></div>
            <!-- Tune-in overlay — populated and animated on channel select.
                 Hidden until playTuneInSequence runs. The composed title
                 card is rendered via .crt-tv__image (existing element);
                 this container holds the case-study panels that appear
                 after the title fades to bg. -->
            <div class="crt-tv__tunein" data-tunein aria-hidden="true">
              <div class="crt-tv__panels" data-panels></div>
            </div>
            <div class="crt-tv__static"></div>
            <div class="crt-tv__scanlines"></div>
            <div class="crt-tv__glare"></div>
          </div>
          <img class="crt-tv__frame" src="/images/vintage_television.webp" alt="Vintage Television" />
          <!-- LED channel display — overlays the TV's "88" digital readout
               area (positioned via CSS at coords measured against the
               vintage_television source image). Defaults to channel 01 (the TV
               guide); swapped to channel_NN.webp when a row highlights. -->
          <img class="crt-tv__channel-display"
               data-channel-display
               src="/images/channel_01.webp"
               alt="" />
          <!-- Invisible button overlays positioned over the TV frame's
               POWER / CHANNEL ▼▲ / VOLUME ▼▲ controls. Coords measured
               from vintage_television.webp via flood-fill of the dark button
               capsules. -->
          <button class="crt-tv__btn crt-tv__btn--power"
                  type="button"
                  data-tv-btn="power"
                  aria-label="Power"></button>
          <button class="crt-tv__btn crt-tv__btn--channel-down"
                  type="button"
                  data-tv-btn="channel-down"
                  aria-label="Channel down"></button>
          <button class="crt-tv__btn crt-tv__btn--channel-up"
                  type="button"
                  data-tv-btn="channel-up"
                  aria-label="Channel up"></button>
          <button class="crt-tv__btn crt-tv__btn--volume-down"
                  type="button"
                  data-tv-btn="volume-down"
                  aria-label="Volume down"></button>
          <button class="crt-tv__btn crt-tv__btn--volume-up"
                  type="button"
                  data-tv-btn="volume-up"
                  aria-label="Volume up"></button>
        </div>
      </div>
    `;
    tvWrap.insertAdjacentHTML('beforeend', tvHtml);

    workWrapper.parentNode?.insertBefore(tvWrap, workWrapper);

    // Populate the channel list with one row per documented project.
    this.renderChannelList();

    // Wire the physical TV button overlays.
    this.wireTvButtons();
  }

  /**
   * Wire click handlers for the TV's POWER / CHANNEL / VOLUME buttons.
   * Buttons are positioned via CSS over the corresponding controls in
   * the vintage_television frame; clicking dispatches the same channel-cycle
   * events that wheel/keys use, so the LED + screen + tune-in stay in
   * lock-step regardless of input method.
   */
  private wireTvButtons(): void {
    const tv = document.querySelector('.crt-tv') as HTMLElement | null;
    if (!tv) return;

    tv.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const btn = target?.closest('[data-tv-btn]') as HTMLElement | null;
      if (!btn) return;
      const action = btn.dataset.tvBtn;

      switch (action) {
      case 'power':
        this.toggleTvPower();
        break;
      case 'channel-up':
        // CHANNEL UP = next higher channel number (down in the array
        // direction the wheel/key handler uses, since "down" cycles to
        // the next channel).
        this.cycleTvChannel(+1);
        break;
      case 'channel-down':
        this.cycleTvChannel(-1);
        break;
      case 'volume-up':
        tvSfx.stepUp();
        break;
      case 'volume-down':
        tvSfx.stepDown();
        break;
      }
    });
  }

  /**
   * Toggle the TV's "powered on/off" state. When off, the screen goes
   * dark and the LED display blanks; the channel list / tune-in are
   * hidden until the user powers it back on.
   */
  private toggleTvPower(): void {
    const tv = document.querySelector('.crt-tv') as HTMLElement | null;
    if (!tv) return;
    const isOff = tv.classList.toggle('is-powered-off');
    const screenBg = document.querySelector('[data-screen-bg]') as HTMLImageElement | null;
    if (isOff) {
      // Going off — cancel any tune-in so we come back cleanly, and
      // swap the base image to the dark / off variant.
      this.cancelTuneIn();
      if (screenBg) screenBg.src = '/images/title-card_base-off.webp';
    } else {
      // Going from off → on: swap to the lit base image and fire the
      // static crackle synced with the visual "screen lights up"
      // moment. Power-off stays silent — CRTs were near-silent on
      // shutdown, only the button click remains.
      if (screenBg) screenBg.src = '/images/title-card_base-on.webp';
      void tvSfx.static();
    }
  }

  /**
   * Cycle the TV channel by ±1, wrapping through guide → projects → guide.
   * Mirrors what wheel-up/down does so the buttons feel identical.
   */
  private cycleTvChannel(delta: 1 | -1): void {
    if (!this.portfolioData) return;
    const documented = this.portfolioData.projects.filter((p) => p.isDocumented);
    if (documented.length === 0) return;

    // Channel slot count: guide (0) + projects (1..N).
    const total = documented.length + 1;

    // Current channel: derive from active tune-in slug (if any) so the
    // button matches what's actually on screen.
    const currentSlug = this.activeTuneInSlug;
    const currentIdx = currentSlug
      ? documented.findIndex((p) => p.slug === currentSlug) + 1
      : 0;

    const nextIdx = ((currentIdx + delta) % total + total) % total;
    // Button press is a user-initiated cycle → trigger the tune-in.
    // (TV-button click sound is handled by tvSfx's delegated listener.)
    this.setTvChannel(nextIdx, { cycle: true });

    // Notify page-transition so its internal currentTvIndex stays in
    // sync — otherwise wheel/key cycling after a button press would
    // start from a stale index.
    window.dispatchEvent(
      new CustomEvent('projects:active-slug-changed', { detail: { index: nextIdx } })
    );
  }

  /**
   * Build the channel-guide text inside the TV screen. Each documented
   * project gets a row showing title / category / year. Sets data-index
   * so setTvChannel can highlight the active row.
   */
  private renderChannelList(): void {
    const container = document.querySelector('[data-channel-list]') as HTMLElement | null;
    if (!container || !this.portfolioData) return;

    const documented = this.portfolioData.projects.filter((p) => p.isDocumented);
    // Channel numbers prefix each row to mirror the LED display: channel
    // 01 is the guide itself ("01 Projects"), and projects start at 02.
    // Title + category stack vertically in the middle column; year sits
    // alone in the right column. Two-digit zero-padded numbers so the
    // left column stays visually aligned.
    const buildRow = (p: typeof documented[number], i: number, ariaHidden = false): string => `
        <li class="crt-tv__channel-row-item"${ariaHidden ? ' aria-hidden="true"' : ''}>
          <button type="button"
                  class="crt-tv__channel-row"
                  data-index="${i}"
                  data-slug="${p.slug}"${ariaHidden ? ' tabindex="-1"' : ''}
                  aria-label="Channel ${i + 2}: open ${p.title} project details">
            <span class="crt-tv__channel-number">${String(i + 2).padStart(2, '0')}</span>
            <span class="crt-tv__channel-text">
              <span class="crt-tv__channel-title">${p.title}</span>
              <span class="crt-tv__channel-category">${p.category}</span>
            </span>
            <span class="crt-tv__channel-meta">${p.year}</span>
          </button>
        </li>`;
    // Render rows TWICE so the GSAP ticker can translate the inner ul up
    // by exactly one set's height and snap back to 0 for a seamless loop.
    // The duplicate set is aria-hidden + non-tabbable so screen readers
    // and keyboard users only encounter each project once.
    const rows = documented.map((p, i) => buildRow(p, i, false)).join('');
    const rowsClone = documented.map((p, i) => buildRow(p, i, true)).join('');

    container.innerHTML = `
      <div class="crt-tv__guide-top">
        <div class="crt-tv__guide-info">
          <span class="crt-tv__guide-info-line crt-tv__guide-info-brand">No Bhad Codes</span>
          <span class="crt-tv__guide-info-line crt-tv__guide-info-show">"Portfolio Guide"</span>
          <span class="crt-tv__guide-info-line crt-tv__guide-info-channel">Channel 01</span>
        </div>
        <div class="crt-tv__guide-feature" aria-hidden="true">
          <svg class="crt-tv__guide-avatar"
               xmlns="http://www.w3.org/2000/svg"
               viewBox="270 165 250 330"
               preserveAspectRatio="xMidYMid meet">
            <defs>
              <filter id="tv-guide-eye-glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g class="crt-tv__guide-avatar-body">
              <path d="M483.84,302.88l-.11-.22c17.83-48.99,4.37-96.42-32.96-131.06l-21.19,96.19c-31.28,2.58-49.67,6.73-62.33,40.7l-61.66,21.19c2.58,17.83-1.35,26.35-15.02,35.76,18.05,12.89,43.5,12.33,55.16,9.87-2.47-1.57-10.43-6.73-12.67-10.65-8.18-14.46,5.94-35.32,28.03-.78,9.87,9.87,28.81,5.27,28.81,5.27-18.95,12.89-54.37,12.67-75.12,11.44,0,0,17.27,10.43,35.65,16.7,18.39,6.17,35.43-4.82,35.43-4.82,1.12,5.49-12.67,42.94-26.79,87.67,17.38,5.16,35.65,7.85,54.26,7.85,36.55,0,71.42-10.2,101.35-29.26-10.99-61.33-21.53-118.28-30.83-155.84Z"/>
              <path d="M301.88,331.02l-28.7,9.87c3.25,10.99,7.06,17.04,14.46,22.53,13.01-9.08,16.7-15.02,14.24-32.4h0Z"/>
              <path d="M408.16,171.04l-1.01,5.61c-2.47,21.97-1.68,41.59-1.01,63.9.34,4.26,1.68,22.31,2.02,26.35,2.02-.34,4.26-.67,6.39-.9h0c.67,0,1.46-.22,2.24-.22h0c1.46-.22,2.91-.34,4.48-.45h.22c.67,0,1.46-.11,2.13-.22h.34c.67,0,1.46-.11,2.24-.22l13.57-61.33c-9.19-10.99-26.46-29.49-31.5-32.29h0l-.11-.22Z"/>
            </g>
            <path class="crt-tv__guide-avatar-eye"
                  d="M390.7,307.37c2.6-6.01,7.08-9.98,12.2-9.98,8.07,0,14.57,9.87,14.57,22.09s-6.5,22.09-14.57,22.09c-5.51,0-10.29-4.61-12.77-11.42,0,0,0,0,0,0l.02.03c2.47,3.74,6.17,6.09,10.3,6.03,7.29-.11,13.01-7.85,12.78-17.15-.01-.45-.05-.89-.08-1.33-6.2,1.12-7.43,3.16-8.44,11.76-1.57-7.51-1.68-10.09-8.97-11.44,7.62-2.35,8.52-3.14,8.52-11.77,1.45,8.59,2.46,10.52,8.88,11.42-.74-8.65-6.44-15.34-13.37-15.23-3.57.05-6.76,1.94-9.06,4.94v-.02Z"/>
          </svg>
        </div>
      </div>
      <div class="crt-tv__guide-bottom" data-channel-ticker-viewport>
        <ul class="crt-tv__channel-rows" data-channel-ticker-track>${rows}${rowsClone}</ul>
      </div>
    `;
    this.startChannelTicker();

    // Delegated click → "tune in" to the channel: title card fills the
    // TV screen briefly, THEN navigation to the project-detail page
    // fires. The pre-roll plays the title-card image full-screen on
    // the TV with a static flash, giving the channel-flip a satisfying
    // beat before the slide transition takes over.
    container.addEventListener('click', (event: Event) => {
      const target = event.target as HTMLElement | null;
      const row = target?.closest('.crt-tv__channel-row') as HTMLElement | null;
      const slug = row?.dataset.slug;
      if (!slug) return;
      void this.playTuneInSequence(slug);
    });
  }

  /**
   * Continuous slow vertical scroll of the channel-row list — the Prevue
   * Guide ticker effect. Rows are rendered twice in the DOM; we tween the
   * track up by exactly the height of one set, then snap back to 0 for a
   * seamless loop. Tick speed scales with row count so adding projects
   * doesn't speed up the ticker.
   */
  private startChannelTicker(): void {
    if (this.channelTickerTween) {
      this.channelTickerTween.kill();
      this.channelTickerTween = null;
    }
    const track = document.querySelector<HTMLElement>('[data-channel-ticker-track]');
    const viewport = document.querySelector<HTMLElement>('[data-channel-ticker-viewport]');
    if (!track || !viewport) return;
    const documented = this.portfolioData?.projects.filter((p) => p.isDocumented) ?? [];
    if (documented.length === 0) return;

    // Wait a frame so the DOM has measured row heights at this viewport
    // size. Without this the first measurement on initial render returns
    // 0 because layout hasn't settled yet.
    requestAnimationFrame(() => {
      // The track contains 2× rows. Half its scrollHeight is the loop
      // distance — translating up by that amount lands the second copy
      // exactly where the first started.
      const totalHeight = track.scrollHeight;
      if (totalHeight <= 0) return;
      const loopDistance = totalHeight / 2;
      // If all rows fit in the viewport with no overflow, no need to
      // ticker — leave the list static.
      if (loopDistance <= viewport.clientHeight) return;
      // Speed: ~16 px / second. Slow enough to read each row as it
      // passes (matches the Prevue Guide pace).
      const TICKER_SPEED_PX_PER_S = 16;
      const duration = loopDistance / TICKER_SPEED_PX_PER_S;
      gsap.set(track, { y: 0 });
      this.channelTickerTween = gsap.to(track, {
        y: -loopDistance,
        duration,
        ease: 'none',
        repeat: -1
      });
    });
  }

  /**
   * "Tune in" sequence — show the composed title card (text baked in),
   * crossfade it to the bg-only version, then auto-cycle case-study
   * panels on top of the bg. The project-detail page stays reachable
   * via a click-through link in the outro panel.
   *
   * Sequence:
   *  1. Static burst, channel list snaps off
   *  2. screen-bg swaps to per-project bg image (no text)
   *  3. Composed title card image fades in OVER the bg (text appears)
   *  4. Hold beat — user reads the title
   *  5. Composed image fades out, revealing the textless bg underneath
   *  6. Panels cycle: intro → challenge → approach → features → results
   *     → built-with → outro. Outro is sticky with case-study link.
   */
  private async playTuneInSequence(slug: string): Promise<void> {
    if (!this.portfolioData) return;
    const project = this.portfolioData.projects.find((p) => p.slug === slug);
    if (!project) return;

    const screen = document.querySelector('.crt-tv__screen') as HTMLElement | null;
    const screenBg = document.querySelector('[data-screen-bg]') as HTMLImageElement | null;
    const channelList = document.querySelector('.crt-tv__channel-list') as HTMLElement | null;
    const staticOverlay = document.querySelector('.crt-tv__static') as HTMLElement | null;
    const tunein = document.querySelector('[data-tunein]') as HTMLElement | null;
    const panelsEl = document.querySelector('[data-panels]') as HTMLElement | null;
    const composedImg = document.querySelector('.crt-tv__image') as HTMLImageElement | null;

    // Fall back to plain navigation if the TV elements aren't present
    // (mobile, or anything that strips the centered TV layout).
    if (!screen || !screenBg || !channelList || !staticOverlay || !tunein || !panelsEl || !composedImg) {
      window.location.hash = `#/projects/${slug}`;
      return;
    }

    // titleCard must be the structured object form for the new flow;
    // legacy string fallback navigates to the detail page.
    const card = typeof project.titleCard === 'object' ? project.titleCard : null;
    if (!card) {
      window.location.hash = `#/projects/${slug}`;
      return;
    }

    // Cancel any in-flight sequence before starting a new one.
    this.cancelTuneIn();
    this.activeTuneInSlug = slug;

    // Sync the LED + highlighted row to this channel so the visible state
    // matches what's about to play. Channel 01 is the guide; this project
    // sits at channel index = (documented index) + 2 (because channel 02
    // is the first project).
    const documented = this.portfolioData.projects.filter((p) => p.isDocumented);
    const projectIdx = documented.findIndex((p) => p.slug === slug);
    if (projectIdx >= 0) {
      const channelNumber = projectIdx + 2;
      this.setChannelDisplay(channelNumber);
      const rows = document.querySelectorAll<HTMLElement>('.crt-tv__channel-row');
      rows.forEach((row) => {
        row.classList.toggle('is-active', Number(row.dataset.index) === projectIdx);
      });
    }

    // Populate panels for this project, then reveal the tune-in container.
    this.populateTuneIn(project, panelsEl);
    tunein.removeAttribute('aria-hidden');

    // Hand the panels the per-card text color (designer-supplied hex from
    // titleCard.color, matching the composed image's text). Compute a
    // contrast veil from the color's luminance so paragraphs read against
    // the bg image without needing a per-card CSS override.
    tunein.style.setProperty('--tunein-color', card.color);
    tunein.style.setProperty('--tunein-veil', contrastVeil(card.color));

    // Reset state for a clean entrance.
    gsap.set(channelList, { opacity: 1 });
    gsap.set(tunein, { opacity: 1 });
    gsap.set(panelsEl, { opacity: 0 });
    gsap.set(composedImg, { opacity: 0 });
    composedImg.src = card.composed;

    // Build the entrance timeline.
    this.tuneInTimeline = gsap.timeline({
      onComplete: () => this.startPanelCycle()
    });
    const tl = this.tuneInTimeline;

    // SFX: channel-change static. Skips the hold so the fade starts
    // right after the attack — snappier than the power-on shape.
    void tvSfx.static({
      // Channel-change shape: snap onto the static at a lower peak than
      // power-on (channel cycling happens often, so the initial burst
      // stays subtle), hold briefly, drop to a quiet residual hiss,
      // sustain that for a beat, then trail off. Mimics a CRT settling
      // onto the new channel after the initial blip of noise.
      peakGain: 0.028,
      attackS: 0.02,
      holdS: 0.07,
      dropToFraction: 0.35,
      dropDurationS: 0.12,
      sustainS: 0.18,
      releaseS: 0.28
    });

    // 1) Static burst + channel list snaps off, bg flashes blank for a
    //    split second (the "between channels" void) before swapping to
    //    the per-project bg.
    tl.to(staticOverlay, { opacity: TV_STATIC_FLASH_OPACITY, duration: 0.06 }, 0)
      .to(channelList, { opacity: 0, duration: 0.05 }, 0)
      .add(() => {
        screenBg.src = '/images/title-card_base-on.webp';
      }, 0.05);

    // 2) Hold the blank for a split second, then swap to per-project bg.
    tl.to({}, { duration: TV_BLANK_FLASH_S });
    tl.add(() => {
      screenBg.src = card.bg;
    });

    // 3) Static settles to residual grain, revealing the new bg.
    tl.to(staticOverlay, { opacity: TV_STATIC_GRAIN_OPACITY, duration: 0.3, ease: 'power2.out' });

    // 4) Hold the bg alone for a beat so the user gets to see the
    //    channel's bg image before the composed title card lands on top.
    tl.to({}, { duration: TV_BG_FLASH_S }, '>');

    // 5) Composed title card fades in over the bg.
    tl.to(composedImg, { opacity: 1, duration: 0.3, ease: 'power2.out' }, '>');

    // 6) Hold the title card so the user reads it before fading to bg.
    tl.to({}, { duration: TV_TITLE_HOLD_S }, '>');

    // 4) Crossfade composed → bg-only (composed fades out, bg already
    //    sits underneath it from step 1).
    tl.to(
      composedImg,
      { opacity: 0, duration: TV_DOCK_DURATION_S, ease: 'power2.inOut' },
      '>'
    );

    // 5) Beat between title-card text fading out and first section text
    //    fading in — distinct text states, not a crossfade.
    tl.to({}, { duration: TV_TEXT_SWAP_BEAT_S }, '>');

    // 6) Reveal the panels container (panels themselves stay at opacity 0
    //    and are faded in one-by-one by startPanelCycle).
    tl.set(panelsEl, { opacity: 1 });
  }

  /**
   * Render the case-study panel sequence into the tune-in container.
   * Called once per channel-select; panels are appended in the order
   * they'll auto-advance through.
   *
   * TV channel copy comes from the project's optional `tv` namespace —
   * a separate, intentionally condensed set of fields for the channel
   * preview. Falls back to the full case-study fields when a `tv` field
   * is missing, so projects without curated TV copy still render.
   */
  private populateTuneIn(project: PortfolioProject, panelsEl: HTMLElement): void {
    // Read from project.tv if present, else fall back to the full fields.
    const tv = project.tv ?? {};
    const tvDescription = tv.description ?? project.description;
    const tvChallenge = tv.challenge ?? project.challenge;
    const tvApproach = tv.approach ?? project.approach;
    const tvKeyFeatures = tv.keyFeatures ?? project.keyFeatures;
    const tvResults = tv.results ?? project.results;
    // Panel sequence — only include panels whose source data is non-empty.
    const panels: string[] = [];

    // Tagline first — punchy one-liner gets a solo beat right after the
    // title card. Each word wrapped in a span so the cycle animation
    // can pop them in one at a time with a slight pulse.
    if (project.tagline) {
      const taglineWords = project.tagline
        .split(/\s+/)
        .map((w) => `<span>${escapeHtml(w)}</span>`)
        .join(' ');
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="tagline">
          <p class="crt-tv__panel-tagline">${taglineWords}</p>
        </article>
      `);
    }

    // Details — Role / Year / Duration in a Looney-Tunes-credit-card
    // two-column layout. Skips rows with empty data.
    const detailRows: string[] = [];
    if (project.role) {
      // Insert a literal newline between the role's leading words and
      // its last word ("Full Stack\nDeveloper"). On desktop dd has
      // white-space: normal so the newline collapses into a single
      // space ("Full Stack Developer" on one line). On mobile dd uses
      // white-space: pre-line so the newline becomes an actual break
      // ("Full Stack" / "Developer" on two lines). Avoids orphaned
      // characters when the column gets narrow.
      const roleWords = project.role.trim().split(/\s+/);
      const roleHtml = roleWords.length > 1
        ? `${escapeHtml(roleWords.slice(0, -1).join(' '))}\n${escapeHtml(roleWords[roleWords.length - 1])}`
        : escapeHtml(project.role);
      detailRows.push(`<dt>Role</dt><dd>${roleHtml}</dd>`);
    }
    if (project.year) {
      detailRows.push(`<dt>Year</dt><dd>${escapeHtml(String(project.year))}</dd>`);
    }
    if (project.duration) {
      detailRows.push(`<dt>Duration</dt><dd>${escapeHtml(project.duration)}</dd>`);
    }
    if (detailRows.length > 0) {
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="details">
          <dl class="crt-tv__panel-details">${detailRows.join('')}</dl>
        </article>
      `);
    }

    // Description: the longer intro paragraph.
    if (tvDescription) {
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="intro">
          <p class="crt-tv__panel-body">${escapeHtml(tvDescription)}</p>
        </article>
      `);
    }

    if (tvChallenge) {
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="challenge">
          <h3 class="crt-tv__panel-heading crt-tv__panel-heading--stacked"><span>The</span><span>Challenge</span></h3>
          <p class="crt-tv__panel-body">${escapeHtml(tvChallenge)}</p>
        </article>
      `);
    }

    if (tvApproach) {
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="approach">
          <h3 class="crt-tv__panel-heading crt-tv__panel-heading--stacked"><span>The</span><span>Approach</span></h3>
          <p class="crt-tv__panel-body">${escapeHtml(tvApproach)}</p>
        </article>
      `);
    }

    if (tvKeyFeatures && tvKeyFeatures.length > 0) {
      // Strip trailing parenthetical explanations on the TV render so
      // the channel preview reads cleanly. The full text (with the
      // parenthetical) still shows on the project-detail page.
      const items = tvKeyFeatures
        .map((f) => f.replace(/\s*\([^)]*\)\s*$/, ''))
        .map((f) => `<li>${escapeHtml(f)}</li>`)
        .join('');
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="features">
          <h3 class="crt-tv__panel-heading">Key Features</h3>
          <ul class="crt-tv__panel-list">${items}</ul>
        </article>
      `);
    }

    if (tvResults && tvResults.length > 0) {
      const items = tvResults.map((r) => `<li>${escapeHtml(r)}</li>`).join('');
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="results">
          <h3 class="crt-tv__panel-heading">Results</h3>
          <ul class="crt-tv__panel-list">${items}</ul>
        </article>
      `);
    }

    // Tools panel — matches the project-detail page's tools pill style
    // (dark-bg tags) so the brand language is consistent across the
    // detail page and the in-TV preview.
    const tech = project.technologies || project.tools || [];
    if (tech.length > 0) {
      const tags = tech.map((t) => `<li class="tool-tag">${escapeHtml(t)}</li>`).join('');
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="tools">
          <h3 class="crt-tv__panel-heading">Tools</h3>
          <ul class="crt-tv__panel-tools">${tags}</ul>
        </article>
      `);
    }

    // Outro — always last. Click-through to detail page is the headline
    // affordance; live URL secondary; hint about channel-changing
    // tertiary so the user knows they can keep browsing.
    const liveLink = project.liveUrl
      ? `<a class="crt-tv__panel-link" href="${escapeAttr(project.liveUrl)}" target="_blank" rel="noopener">Live: ${escapeHtml(project.liveUrl)}</a>`
      : '';
    panels.push(`
      <article class="crt-tv__panel crt-tv__panel--outro" data-panel-key="outro">
        <a class="crt-tv__panel-cta" href="#/projects/${escapeAttr(project.slug)}">View full case study →</a>
        ${liveLink}
        <p class="crt-tv__panel-hint">Press ↑ / ↓ to change channel · Esc to exit</p>
      </article>
    `);

    panelsEl.innerHTML = panels.join('');
  }

  /**
   * Crossfade through the case-study panels like Looney Tunes credit
   * cards: panel A appears (heading flashes in first, then body), holds,
   * fades out as panel B appears, etc. Outro is sticky as the terminal
   * frame so the case-study click-through stays available.
   *
   * Per-panel sub-sequence:
   *   1. Heading scale-flashes in (if the panel has one)
   *   2. Brief beat — heading alone announces the section
   *   3. Body content fades in below the heading
   *   4. Hold so the user can read it
   *   5. Whole panel fades out (unless outro/last)
   *
   * Single-playthrough (no loop) — the outro is the terminal frame.
   */
  private startPanelCycle(): void {
    const panelsEl = document.querySelector('[data-panels]') as HTMLElement | null;
    if (!panelsEl) return;

    const panels = Array.from(panelsEl.querySelectorAll<HTMLElement>('.crt-tv__panel'));
    if (panels.length === 0) return;

    // Reset everything: panels visible (containers) but their children
    // start hidden so the heading-then-body sequence works per-panel.
    panels.forEach((panel) => {
      panel.classList.remove('is-heading-only', 'is-body-only');
      gsap.set(panel, { opacity: 0 });
      // Reset transform too so the mobile auto-scroll doesn't carry over
      // from a previous cycle (children would still be y:-300 etc).
      gsap.set(panel.children, { opacity: 0, scale: 1, y: 0 });
    });

    // Panels whose headings get the "flash alone, fade out, body appears"
    // treatment. List-style panels (features, results, tools) keep
    // heading + body together so the section title stays on screen.
    const FLASH_HEADING_KEYS = new Set(['challenge', 'approach']);

    this.tuneInScrollTween = gsap.timeline();
    const tl = this.tuneInScrollTween;

    const SCROLL_KEYS = new Set(['intro', 'challenge', 'approach']);
    const isMobile = window.matchMedia('(max-width: 767px)').matches;

    panels.forEach((panel, idx) => {
      const key = panel.dataset.panelKey ?? '';
      const isOutro = key === 'outro';
      const isLast = idx === panels.length - 1;
      const heading = panel.querySelector('.crt-tv__panel-heading') as HTMLElement | null;
      const body = Array.from(panel.children).filter((c) => c !== heading) as HTMLElement[];
      const useFlash = !!heading && FLASH_HEADING_KEYS.has(key);
      // Mobile prose panels skip the fade-in entirely — content slides
      // in from off-bottom at full opacity, scrolls past, and exits off-
      // top. No "appear at center, jump to bottom, scroll up" flash.
      const isScrollPanel = isMobile && SCROLL_KEYS.has(key);

      // Reveal the panel container (children remain at opacity 0).
      tl.set(panel, { opacity: 1 });

      if (useFlash && heading) {
        // Heading-only mode: body is display:none so the heading is the
        // sole layout item, perfectly centered with no body whitespace.
        tl.add(() => {
          panel.classList.add('is-heading-only');
          panel.classList.remove('is-body-only');
        });
        // Each word in the heading pops in with an overshoot pulse,
        // staggered ~0.18s apart. Heading itself starts visible so the
        // word spans (which are at opacity 0 by default reset) drive
        // the animation.
        gsap.set(heading, { opacity: 1 });
        const headingWords = heading.querySelectorAll('span');
        if (headingWords.length > 0) {
          tl.fromTo(
            headingWords,
            { opacity: 0, scale: 0.7 },
            { opacity: 1, scale: 1, duration: TV_WORD_PULSE_S, ease: 'back.out(2.4)', stagger: TV_WORD_STAGGER_S }
          );
        } else {
          // Fallback: heading without word spans — pop the whole thing.
          tl.fromTo(
            heading,
            { opacity: 0, scale: 0.9 },
            { opacity: 1, scale: 1, duration: TV_HEADING_FLASH_S, ease: 'back.out(2)' }
          );
        }
        tl.to({}, { duration: TV_HEADING_HOLD_S });
        tl.to(heading, { opacity: 0, duration: TV_TEXT_FADE_S, ease: 'power2.in' });

        // Body-only mode: heading is display:none. Body is now the sole
        // centered content — no spatial overlap with where the heading
        // just was, just a clean swap.
        tl.add(() => {
          panel.classList.remove('is-heading-only');
          panel.classList.add('is-body-only');
        });
        if (body.length > 0) {
          tl.set(body, { opacity: 0 });
          if (isScrollPanel) {
            // Mobile prose: pre-position body off-bottom at full opacity
            // so the auto-scroll below picks it up without a centered-
            // flash beforehand.
            tl.add(() => {
              const screenH = panel.clientHeight;
              const contentH = panel.scrollHeight;
              const startY = (screenH + contentH) / 2;
              gsap.set(body, { opacity: 1, y: startY });
            });
          } else {
            tl.to(
              body,
              { opacity: 1, duration: TV_TEXT_FADE_S, stagger: 0.06, ease: 'power2.out' }
            );
          }
        }
      } else if (key === 'tagline') {
        // Tagline panel — each word in the tagline pops in with a pulse
        // for a Looney-Tunes "ka-pow!" landing.
        const tagline = panel.querySelector('.crt-tv__panel-tagline') as HTMLElement | null;
        if (tagline) {
          gsap.set(tagline, { opacity: 1 });
          const words = tagline.querySelectorAll('span');
          if (words.length > 0) {
            gsap.set(words, { opacity: 0, scale: 0.7 });
            tl.to(words, {
              opacity: 1,
              scale: 1,
              duration: TV_WORD_PULSE_S,
              ease: 'back.out(2.4)',
              stagger: TV_WORD_STAGGER_S
            });
          }
        }
      } else {
        // Default: fade all children in together (heading + body, or
        // bodyless panels like intro/details/outro). Heading stays on
        // screen with the items for the duration of the section.
        //
        // EXCEPTION: on mobile prose panels, pre-position the children
        // off-screen-bottom at full opacity instead of fading in at
        // center — the auto-scroll tween below then moves them up into
        // view with no "fade in at center, jump to bottom" flash.
        if (isScrollPanel) {
          tl.add(() => {
            const screenH = panel.clientHeight;
            const contentH = panel.scrollHeight;
            const startY = (screenH + contentH) / 2;
            gsap.set(panel.children, { opacity: 1, y: startY });
          });
        } else {
          tl.to(
            panel.children,
            { opacity: 1, duration: TV_TEXT_FADE_S, stagger: 0.06, ease: 'power2.out' }
          );
        }
      }

      // Hold so the user can read it. Paragraphs get more time than
      // short panels (tagline / details / lists). Mobile scroll-prose
      // panels get a longer hold so the auto-scroll reads comfortably.
      const baseHold = TV_PANEL_HOLD_S[key] ?? TV_SECTION_PAUSE_S_DEFAULT;
      const holdSeconds = isScrollPanel
        ? baseHold * TV_MOBILE_SCROLL_HOLD_MULTIPLIER
        : baseHold;
      tl.add(() => {
        if (!isMobile) return;
        const screenH = panel.clientHeight;
        const contentH = panel.scrollHeight;
        const overflows = contentH > screenH;
        if (!isScrollPanel && !overflows) return;

        // Scroll content from off-screen-bottom to off-screen-top. For
        // scroll-prose panels children are already pre-positioned at
        // startY by the fade-in branch above, so this tween just moves
        // them up. For non-prose panels with overflow, fromTo with the
        // same startY ensures they jump to off-bottom first.
        const startY = (screenH + contentH) / 2;
        const endY = -(screenH + contentH) / 2;
        if (isScrollPanel) {
          gsap.to(panel.children, {
            y: endY,
            duration: holdSeconds,
            ease: 'none'
          });
        } else {
          gsap.fromTo(
            panel.children,
            { y: startY },
            { y: endY, duration: holdSeconds, ease: 'none' }
          );
        }
      });
      tl.to({}, { duration: holdSeconds });

      // Fade out — but not the outro (it sticks as the terminal frame)
      // and not the last panel (no successor to cross into).
      if (!isOutro && !isLast) {
        tl.to(panel, { opacity: 0, duration: TV_TEXT_FADE_S, ease: 'power2.in' });
      }
    });
  }

  /**
   * Animated channel-flip back to channel 01 (the guide). Mirrors the
   * project tune-in's static-burst + brightness-dim + bg-swap flow so
   * cycling INTO the guide reads the same as cycling out of it. The
   * destination state is the channel list visible over title-card_base.
   */
  private transitionToGuide(): void {
    // Tear down any in-flight tune-in (timelines, panels, classes) but
    // skip the instant visual reset — the animation below handles it.
    this.cancelTuneIn();

    const screenBg = document.querySelector('[data-screen-bg]') as HTMLImageElement | null;
    const channelList = document.querySelector('.crt-tv__channel-list') as HTMLElement | null;
    const staticOverlay = document.querySelector('.crt-tv__static') as HTMLElement | null;
    if (!screenBg || !channelList || !staticOverlay) return;

    // Channel list starts hidden and fades back in at the end.
    gsap.set(channelList, { opacity: 0 });

    this.tuneInTimeline = gsap.timeline();
    const tl = this.tuneInTimeline;

    // SFX: same channel-change crackle as the project tune-in (no
    // hold — fade starts right after attack).
    void tvSfx.static({
      // Channel-change shape: snap onto the static at a lower peak than
      // power-on (channel cycling happens often, so the initial burst
      // stays subtle), hold briefly, drop to a quiet residual hiss,
      // sustain that for a beat, then trail off. Mimics a CRT settling
      // onto the new channel after the initial blip of noise.
      peakGain: 0.028,
      attackS: 0.02,
      holdS: 0.07,
      dropToFraction: 0.35,
      dropDurationS: 0.12,
      sustainS: 0.18,
      releaseS: 0.28
    });

    // Static peak + bg src swaps to the blank base.
    tl.to(staticOverlay, { opacity: TV_STATIC_FLASH_OPACITY, duration: 0.06 }, 0)
      .add(() => {
        screenBg.src = '/images/title-card_base-on.webp';
      }, 0.05);

    // Hold the blank under the static peak (between-channels void beat).
    tl.to({}, { duration: TV_BLANK_FLASH_S });

    // Static settles, revealing the base bg alone (no channel list yet).
    tl.to(staticOverlay, { opacity: TV_STATIC_GRAIN_OPACITY, duration: 0.3, ease: 'power2.out' });

    // Hold the base bg alone for TV_BG_FLASH_S — the same beat per-project
    // bgs get on project channels before the composed title card lands.
    // Keeps channel 01's transition shape consistent with the others.
    tl.to({}, { duration: TV_BG_FLASH_S }, '>');

    // Channel list fades in.
    tl.to(channelList, { opacity: 1, duration: 0.3, ease: 'power2.out' }, '>');

    // LED shows channel 01.
    this.setChannelDisplay(1);
  }

  /**
   * Brief CRT static burst — fires when the active channel changes
   * (cycling via wheel/keys, or selecting a channel for tune-in). Sells
   * the channel-flip without obscuring the screen for long.
   */
  private flashChannelStatic(): void {
    const staticOverlay = document.querySelector('.crt-tv__static') as HTMLElement | null;
    if (!staticOverlay) return;
    gsap.killTweensOf(staticOverlay);
    gsap.timeline()
      .to(staticOverlay, { opacity: TV_STATIC_FLASH_OPACITY, duration: 0.04 })
      .to(staticOverlay, { opacity: 0, duration: 0.22, ease: 'power2.out' });
  }

  /**
   * Cancel any in-flight tune-in sequence and reset the TV to the
   * channel-guide view. Safe to call when no sequence is active.
   */
  private cancelTuneIn(): void {
    if (this.tuneInTimeline) {
      this.tuneInTimeline.kill();
      this.tuneInTimeline = null;
    }
    if (this.tuneInScrollTween) {
      this.tuneInScrollTween.kill();
      this.tuneInScrollTween = null;
    }
    this.activeTuneInSlug = null;

    const screenBg = document.querySelector('[data-screen-bg]') as HTMLImageElement | null;
    const channelList = document.querySelector('.crt-tv__channel-list') as HTMLElement | null;
    const tunein = document.querySelector('[data-tunein]') as HTMLElement | null;
    const composedImg = document.querySelector('.crt-tv__image') as HTMLImageElement | null;
    const staticOverlay = document.querySelector('.crt-tv__static') as HTMLElement | null;
    const panelsEl = document.querySelector('[data-panels]') as HTMLElement | null;

    // Restore channel-guide state: blank-screen base, channel list visible,
    // composed title card hidden, panels emptied.
    if (screenBg) {
      gsap.killTweensOf(screenBg);
      gsap.set(screenBg, { opacity: 1 });
      screenBg.src = '/images/title-card_base-on.webp';
    }
    if (channelList) gsap.set(channelList, { opacity: 1 });
    if (tunein) {
      gsap.set(tunein, { clearProps: 'all' });
      tunein.style.removeProperty('--tunein-color');
      tunein.style.removeProperty('--tunein-veil');
      tunein.setAttribute('aria-hidden', 'true');
    }
    if (composedImg) {
      gsap.set(composedImg, { opacity: 0, clearProps: 'transform' });
    }
    if (panelsEl) {
      gsap.set(panelsEl, { opacity: 0, clearProps: 'transform' });
      panelsEl.innerHTML = '';
    }
    if (staticOverlay) gsap.set(staticOverlay, { opacity: 0 });

    // Clear the highlighted row so the guide returns to its default
    // state — heading "01 PROJECTS" highlighted via :has(), no row
    // marked active. Without this, rows keep the .is-active class set
    // during the prior tune-in.
    const rows = document.querySelectorAll<HTMLElement>('.crt-tv__channel-row');
    rows.forEach((row) => row.classList.remove('is-active'));

    // LED returns to channel 01 (TV guide).
    this.setChannelDisplay(1);
  }

  /**
   * Highlight a specific project on the CRT TV's channel guide by index
   * in the documented list. Called from page-transition.ts via the
   * 'projects:set-tv-channel' event — page-transition owns the index
   * because it gates the boundary-exit navigation (scroll past last →
   * contact, scroll above first → intro).
   *
   * Cycling channels via wheel/keys only updates the highlighted row;
   * the actual title-card image is reserved for the tune-in sequence
   * triggered by Enter/click.
   */
  private setTvChannel(index: number, options: { cycle?: boolean } = {}): void {
    if (!this.portfolioData) return;
    const documented = this.portfolioData.projects.filter((p) => p.isDocumented);
    if (documented.length === 0) return;

    // index 0 = channel 01 (TV guide / projects page itself)
    // index 1+ = channel 02+ (individual project rows)
    const maxIdx = documented.length;
    const safeIndex = Math.max(0, Math.min(index, maxIdx));

    // What's currently on screen? activeTuneInSlug is set when a project
    // tune-in is playing/parked; null means we're on the guide.
    const prevSlug = this.activeTuneInSlug;
    const prevChannelIdx = prevSlug
      ? documented.findIndex((p) => p.slug === prevSlug) + 1
      : 0;

    // No-op if the channel didn't actually change.
    if (prevChannelIdx === safeIndex) return;

    // Passive sync (page entry, carousel back-nav) — just highlight the
    // matching row + update the LED. Don't fire tune-ins or transitions
    // since the user didn't ask to switch channels; they just landed
    // here. This prevents flashing the wrong bg when navigating between
    // main tiles quickly.
    if (!options.cycle) {
      const rows = document.querySelectorAll<HTMLElement>('.crt-tv__channel-row');
      rows.forEach((row) => {
        const rowIdx = Number(row.dataset.index);
        row.classList.toggle('is-active', safeIndex > 0 && rowIdx === safeIndex - 1);
      });
      this.setChannelDisplay(safeIndex + 1);
      return;
    }

    if (safeIndex === 0) {
      // Channel 01: animated transition back to the channel guide,
      // mirroring the tune-in's static + brightness flow.
      this.transitionToGuide();
      return;
    }

    // Channel 02+: tune in to that project. playTuneInSequence handles
    // canceling any prior tune-in, swapping the bg, firing its own
    // static burst, and updating the LED + row highlight.
    const project = documented[safeIndex - 1];
    if (project) {
      void this.playTuneInSequence(project.slug);
    }
  }

  /**
   * Update the LED channel readout. Numbers map to public/images/
   * channel_NN.webp (zero-padded to 2 digits). channel 01 is reserved
   * for the TV guide / blank-screen state; project channels start at 02.
   */
  private setChannelDisplay(channelNumber: number): void {
    const display = document.querySelector<HTMLImageElement>('[data-channel-display]');
    if (!display) return;
    const padded = String(channelNumber).padStart(2, '0');
    const nextSrc = `/images/channel_${padded}.webp`;
    if (!display.src.endsWith(nextSrc)) {
      display.src = nextSrc;
    }
  }

  /**
   * Create a single project card element
   */
  private createProjectCard(project: PortfolioProject, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'work-card';
    card.dataset.projectId = project.id;
    card.dataset.projectSlug = project.slug;

    const categoryName = this.getCategoryName(project.category);

    card.innerHTML = `
      <div class="card-container index-${index}" tabindex="0" role="button" aria-label="View ${project.title} project details">
        <div class="project-card-title">
          ${ARROW_SVG}
          <h3>${project.title}</h3>
        </div>
        <div class="card-right-content">
          <span class="card-category">${categoryName}</span>
          <span class="round-label">${project.year}</span>
        </div>
      </div>
    `;

    return card;
  }

  /**
   * Get human-readable category name
   */
  private getCategoryName(categoryId: string): string {
    const categoryMap: Record<string, string> = {
      websites: 'Website',
      applications: 'App',
      extensions: 'Extension',
      'e-commerce': 'E-Commerce',
      ecommerce: 'E-Commerce' // Legacy support
    };
    return categoryMap[categoryId] || categoryId;
  }

  /**
   * Attach click and keyboard listeners to cards
   */
  private attachCardListeners(): void {
    const cards = this.projectsContent?.querySelectorAll('.work-card');
    if (!cards) return;

    cards.forEach((card) => {
      const container = card.querySelector('.card-container');
      if (!container) return;

      const projectSlug = (card as HTMLElement).dataset.projectSlug;

      // Click handler - navigate to project detail
      container.addEventListener('click', () => {
        this.navigateToProject(projectSlug || '');
      });

      // Keyboard handler (Enter/Space)
      container.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          e.preventDefault();
          this.navigateToProject(projectSlug || '');
        }
      });
    });
  }

  /**
   * Navigate to project detail page
   */
  private navigateToProject(slug: string): void {
    if (!slug) return;
    window.location.hash = `#/projects/${slug}`;
  }

  /**
   * Render project detail content
   */
  private renderProjectDetail(
    project: PortfolioProject,
    options: { skipEntrance?: boolean } = {}
  ): void {
    if (!this.projectDetailSection) return;

    // Update hero image — prefer heroImage, fall back to the first
    // screenshot. The title-card is intentionally NOT used as a fallback
    // anymore: the new full-canvas exports (1426×1093 with the actual
    // title-card content occupying only the inner ~72% × 70%) include
    // the transparent artboard around the artwork, which renders as
    // empty space framing the image on the project-detail page.
    // Screenshots show real product UI and read better as a hero anyway.
    const heroImg = this.projectDetailSection.querySelector<HTMLImageElement>('#project-hero-img');
    if (heroImg) {
      const heroSrc = project.heroImage || project.screenshots?.[0] || null;
      if (heroSrc) {
        heroImg.src = heroSrc;
        heroImg.alt = `${project.title} hero image`;
        heroImg.classList.remove('placeholder');
      } else {
        heroImg.src = '/images/project-placeholder.svg';
        heroImg.alt = `${project.title} - image coming soon`;
        heroImg.classList.add('placeholder');
      }
    }

    // Update title — wrap in anchor when liveUrl exists so the title itself
    // is the primary CTA (opens live site in new tab). External icon appears
    // after the text as a visual affordance.
    const titleEl = this.projectDetailSection.querySelector('#project-title');
    if (titleEl) {
      if (project.liveUrl) {
        titleEl.innerHTML = `<a href="${project.liveUrl}" target="_blank" rel="noopener noreferrer" class="project-title-link">${project.title}<span class="project-title-icon" aria-hidden="true">${EXTERNAL_LINK_SVG}</span><span class="sr-only"> (opens in new tab)</span></a>`;
      } else {
        titleEl.textContent = project.title;
      }
    }

    // Update tagline
    const taglineEl = this.projectDetailSection.querySelector('#project-tagline');
    if (taglineEl) {
      taglineEl.textContent = project.tagline || '';
    }

    // Update status badge
    const statusEl = this.projectDetailSection.querySelector('#project-status');
    if (statusEl) {
      const statusText = this.formatStatus(project.status);
      statusEl.textContent = statusText;
      statusEl.className = `project-status-badge status-${project.status}`;
    }

    // Update role
    const roleEl = this.projectDetailSection.querySelector('#project-role');
    if (roleEl) {
      roleEl.textContent = project.role;
    }

    // Update year
    const yearEl = this.projectDetailSection.querySelector('#project-year');
    if (yearEl) {
      yearEl.textContent = project.year.toString();
    }

    // Update duration
    const durationEl = this.projectDetailSection.querySelector('#project-duration');
    const durationGroup = this.projectDetailSection.querySelector('#project-duration-group');
    if (durationEl && durationGroup) {
      if (project.duration) {
        durationEl.textContent = project.duration;
        (durationGroup as HTMLElement).style.display = '';
      } else {
        (durationGroup as HTMLElement).style.display = 'none';
      }
    }

    // Update tools
    const toolsEl = this.projectDetailSection.querySelector('#project-tools');
    if (toolsEl) {
      toolsEl.innerHTML = project.tools
        .map((tool) => `<span class="tool-tag">${tool}</span>`)
        .join('');
    }

    // Update description (use innerHTML with sanitized line breaks)
    const descEl = this.projectDetailSection.querySelector('#project-description');
    if (descEl) {
      descEl.innerHTML = formatTextWithLineBreaks(project.description);
    }

    // Update case study sections
    this.renderCaseStudySections(project);

    // Clear screenshots section (temporarily removed pending layout redesign)
    const infoEl = this.projectDetailSection.querySelector('#project-info');
    if (infoEl) {
      infoEl.innerHTML = '';
    }

    // Update links — live URL is now the title itself, so only render the
    // source code link here (when present).
    const linksEl = this.projectDetailSection.querySelector('#project-links');
    if (linksEl) {
      linksEl.innerHTML = project.repoUrl
        ? `<a href="${project.repoUrl}" target="_blank" rel="noopener noreferrer">${GITHUB_SVG}Source Code</a>`
        : '';
    }

    // GSAP entrance animations for detail page elements — skipped on
    // carousel navigation between projects so left/right scrolling doesn't
    // re-play a top-down drop-in every time.
    if (!options.skipEntrance) {
      this.animateDetailEntrance();
    }
  }

  /**
   * Format status for display
   */
  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'in-progress': 'In Progress',
      completed: 'Completed',
      planned: 'Planned'
    };
    return statusMap[status] || status;
  }

  /**
   * Render case study sections (challenge, approach, results, features)
   */
  private renderCaseStudySections(project: PortfolioProject): void {
    if (!this.projectDetailSection) return;

    // Overview section (Challenge + Approach combined)
    const overviewSection = this.projectDetailSection.querySelector('#project-overview-section');
    const challengeEl = this.projectDetailSection.querySelector('#project-challenge');
    const approachEl = this.projectDetailSection.querySelector('#project-approach');
    if (overviewSection && challengeEl && approachEl) {
      if (project.challenge) {
        challengeEl.textContent = project.challenge;
        (challengeEl as HTMLElement).style.display = '';
      } else {
        (challengeEl as HTMLElement).style.display = 'none';
      }
      if (project.approach) {
        approachEl.textContent = project.approach;
        (approachEl as HTMLElement).style.display = '';
      } else {
        (approachEl as HTMLElement).style.display = 'none';
      }
      (overviewSection as HTMLElement).style.display =
        project.challenge || project.approach ? '' : 'none';
    }

    // Key Features section
    const featuresSection = this.projectDetailSection.querySelector('#project-features-section');
    const featuresEl = this.projectDetailSection.querySelector('#project-features');
    if (featuresSection && featuresEl) {
      if (project.keyFeatures && project.keyFeatures.length > 0) {
        featuresEl.innerHTML = project.keyFeatures.map((feature) => `<li>${feature}</li>`).join('');
        (featuresSection as HTMLElement).style.display = '';
      } else {
        (featuresSection as HTMLElement).style.display = 'none';
      }
    }

    // Results section
    const resultsSection = this.projectDetailSection.querySelector('#project-results-section');
    const resultsEl = this.projectDetailSection.querySelector('#project-results');
    if (resultsSection && resultsEl) {
      if (project.results && project.results.length > 0) {
        resultsEl.innerHTML = project.results.map((result) => `<li>${result}</li>`).join('');
        (resultsSection as HTMLElement).style.display = '';
      } else {
        (resultsSection as HTMLElement).style.display = 'none';
      }
    }
  }

  /**
   * GSAP staggered entrance animation for project cards
   */
  private animateCardEntrance(): void {
    const cards = this.projectsContent?.querySelectorAll('.card-container');
    if (!cards?.length) return;

    const ENTRANCE_DELAY = 0.3;
    const STAGGER_INTERVAL = 0.1;
    const DURATION = 0.5;
    const EASE = 'power2.out';

    gsap.set(cards, { y: '-105%' });
    gsap.to(cards, {
      y: 0,
      duration: DURATION,
      stagger: STAGGER_INTERVAL,
      delay: ENTRANCE_DELAY,
      ease: EASE,
      clearProps: 'transform'
    });
  }

  /**
   * GSAP heading divider scale-in animation
   */
  private animateHeadingDivider(): void {
    const divider = this.projectsContent?.querySelector('.heading-divider');
    if (!divider) return;

    const DELAY = 0.4;
    const DURATION = 0.8;
    const EASE = 'power2.out';

    gsap.set(divider, { scaleX: 0 });
    gsap.to(divider, {
      scaleX: 1,
      duration: DURATION,
      delay: DELAY,
      ease: EASE,
      clearProps: 'transform'
    });
  }

  /**
   * Animate project detail elements on entrance using GSAP
   */
  private animateDetailEntrance(): void {
    if (!this.projectDetailSection) return;

    const backButton = this.projectDetailSection.querySelector('.back-button');
    const header = this.projectDetailSection.querySelector('.worksub-header');
    const intro = this.projectDetailSection.querySelector('.worksub-intro');

    // Kill existing tweens on these elements
    const elements = [backButton, header, intro].filter(Boolean) as HTMLElement[];
    elements.forEach((el) => {
      el.classList.remove('leaving');
      gsap.killTweensOf(el);
    });

    // Back button — slide in from left
    if (backButton) {
      gsap.fromTo(
        backButton,
        { opacity: 0, x: '-170%' },
        { opacity: 1, x: 0, duration: 0.8, delay: 0.8, ease: 'power2.out', clearProps: 'transform,opacity' }
      );
    }

    // Header image — fade in from top
    if (header) {
      gsap.fromTo(
        header,
        { opacity: 0, y: '-30%' },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.3, ease: 'power2.out', clearProps: 'transform,opacity' }
      );
    }

    // Intro section — fade in from bottom
    if (intro) {
      gsap.fromTo(
        intro,
        { opacity: 0, y: 100 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.5, ease: 'power2.out', clearProps: 'transform,opacity' }
      );
    }
  }

  /**
   * Set up back button handler
   */
  private setupBackButton(): void {
    const backBtn = document.getElementById('project-back-btn');
    if (!backBtn) return;

    backBtn.addEventListener('click', () => {
      this.goBackToProjects();
    });

    // Keyboard support
    backBtn.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.goBackToProjects();
      }
    });
  }

  /**
   * Navigate back to projects list
   * PageTransitionModule handles the transition animation
   */
  private goBackToProjects(): void {
    window.location.hash = '#/projects';
  }

  /**
   * Clean up module
   */
  protected async onDestroy(): Promise<void> {
    window.removeEventListener('hashchange', this.handleHashChange.bind(this));
    this.projectsSection = null;
    this.projectsContent = null;
    this.projectDetailSection = null;
    this.portfolioData = null;
    this.currentProjectSlug = null;
  }
}
