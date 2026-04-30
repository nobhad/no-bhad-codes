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
}

interface PortfolioData {
  projects: PortfolioProject[];
  categories: Array<{ id: string; name: string; count: number }>;
}

// Minimum documented projects required to show project list
const MIN_DOCUMENTED_PROJECTS = 2;

// Tune-in sequence timing & visual constants. Centralized so the pacing
// of the title card → Looney-Tunes-credit-card panel cycle can be tuned
// in one place. Each panel fades in, holds, then fades out as the next
// fades in (crossfade) — the outro panel is sticky as the terminal frame.
const TV_STATIC_FLASH_OPACITY = 0.85; // peak of the channel-change burst
const TV_STATIC_GRAIN_OPACITY = 0.18; // residual grain after the burst
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
const TV_TEXT_SWAP_BEAT_S = 0.35;     // empty beat between title fade-out and first panel fade-in
const TV_TEXT_FADE_S = 0.45;          // panel fade-in / fade-out duration
const TV_HEADING_FLASH_S = 0.35;      // section heading scale-flash duration
const TV_HEADING_HOLD_S = 2.0;        // beat heading sits alone before body fades in

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
      if (typeof index === 'number') this.setTvChannel(index);
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
    }
    // If not enough documented projects, keep the existing WIP sign
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

    // Render CRT TV. The old work-card hover preview is gone — cards are
    // display:none and the channel guide on the TV is the primary nav.
    this.renderCrtTv();

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

    // Hide the cards work wrapper — its content is now expressed as the
    // channel-list text inside the TV screen. Kept in DOM (display:none)
    // so the existing card click handlers still resolve a target slug
    // when keyboard/screen-reader users tab through them.
    (workWrapper as HTMLElement).style.display = 'none';

    // Centered TV container. Single child of projects-content (heading +
    // hr stay above) so the TV lands in the middle of the section.
    const tvWrap = document.createElement('div');
    tvWrap.className = 'projects-tv-wrap';

    const tvHtml = `
      <div class="crt-tv">
        <div class="crt-tv__wrapper">
          <img class="crt-tv__screen-bg" src="/images/title-card_base.webp" alt="" data-screen-bg />
          <div class="crt-tv__screen">
            <img class="crt-tv__image" src="" alt="Project preview" />
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
          <img class="crt-tv__frame" src="/images/vintage_tv.webp" alt="Vintage Television" />
          <!-- LED channel display — overlays the TV's "88" digital readout
               area (positioned via CSS at coords measured against the
               vintage_tv source image). Defaults to channel 01 (the TV
               guide); swapped to channel_NN.webp when a row highlights. -->
          <img class="crt-tv__channel-display"
               data-channel-display
               src="/images/channel_01.webp"
               alt="" />
        </div>
      </div>
    `;
    tvWrap.insertAdjacentHTML('beforeend', tvHtml);

    workWrapper.parentNode?.insertBefore(tvWrap, workWrapper);

    // Populate the channel list with one row per documented project.
    this.renderChannelList();
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
    const rows = documented
      .map(
        (p, i) => `
        <li class="crt-tv__channel-row-item">
          <button type="button"
                  class="crt-tv__channel-row"
                  data-index="${i}"
                  data-slug="${p.slug}"
                  aria-label="Channel ${i + 2}: open ${p.title} project details">
            <span class="crt-tv__channel-number">${String(i + 2).padStart(2, '0')}</span>
            <span class="crt-tv__channel-text">
              <span class="crt-tv__channel-title">${p.title}</span>
              <span class="crt-tv__channel-category">${p.category}</span>
            </span>
            <span class="crt-tv__channel-meta">${p.year}</span>
          </button>
        </li>`
      )
      .join('');

    container.innerHTML = `
      <h3 class="crt-tv__channel-heading">
        <span class="crt-tv__channel-number">01</span>
        <span class="crt-tv__channel-title">Projects</span>
      </h3>
      <ul class="crt-tv__channel-rows">${rows}</ul>
    `;

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

    // 1) Static burst + channel list snaps off + bg swap (simultaneous).
    tl.to(staticOverlay, { opacity: TV_STATIC_FLASH_OPACITY, duration: 0.06 }, 0)
      .to(channelList, { opacity: 0, duration: 0.05 }, 0)
      .add(() => {
        screenBg.src = card.bg;
      }, 0.05);

    // 2) Composed title card fades in while static settles.
    tl.to(composedImg, { opacity: 1, duration: 0.25, ease: 'power2.out' }, 0.08)
      .to(
        staticOverlay,
        { opacity: TV_STATIC_GRAIN_OPACITY, duration: 0.3, ease: 'power2.out' },
        0.1
      );

    // 3) Hold the title card so the user reads it before fading to bg.
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
   * Each panel only renders if its source data exists — projects without
   * a `liveUrl`, for example, get an outro panel without the "Live at"
   * line.
   */
  private populateTuneIn(project: PortfolioProject, panelsEl: HTMLElement): void {
    // Panel sequence — only include panels whose source data is non-empty.
    const panels: string[] = [];

    // Details first — Role / Year / Duration plays right after the title
    // card, like the credit card in a Looney Tunes opening. Two-column
    // layout (label | value); skips empty rows so older projects don't
    // show blanks.
    const detailRows: string[] = [];
    if (project.role) {
      detailRows.push(`<dt>Role</dt><dd>${escapeHtml(project.role)}</dd>`);
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

    // Tagline gets its own card so the punchy one-liner has a beat —
    // e.g. "You're looking at it!" for the portfolio site itself.
    if (project.tagline) {
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="tagline">
          <p class="crt-tv__panel-tagline">${escapeHtml(project.tagline)}</p>
        </article>
      `);
    }

    // Description: the longer intro paragraph.
    if (project.description) {
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="intro">
          <p class="crt-tv__panel-body">${escapeHtml(project.description)}</p>
        </article>
      `);
    }

    if (project.challenge) {
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="challenge">
          <h3 class="crt-tv__panel-heading crt-tv__panel-heading--stacked"><span>The</span><span>Challenge</span></h3>
          <p class="crt-tv__panel-body">${escapeHtml(project.challenge)}</p>
        </article>
      `);
    }

    if (project.approach) {
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="approach">
          <h3 class="crt-tv__panel-heading crt-tv__panel-heading--stacked"><span>The</span><span>Approach</span></h3>
          <p class="crt-tv__panel-body">${escapeHtml(project.approach)}</p>
        </article>
      `);
    }

    if (project.keyFeatures && project.keyFeatures.length > 0) {
      const items = project.keyFeatures.map((f) => `<li>${escapeHtml(f)}</li>`).join('');
      panels.push(`
        <article class="crt-tv__panel" data-panel-key="features">
          <h3 class="crt-tv__panel-heading">Key Features</h3>
          <ul class="crt-tv__panel-list">${items}</ul>
        </article>
      `);
    }

    if (project.results && project.results.length > 0) {
      const items = project.results.map((r) => `<li>${escapeHtml(r)}</li>`).join('');
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
      gsap.set(panel.children, { opacity: 0, scale: 1 });
    });

    // Panels whose headings get the "flash alone, fade out, body appears"
    // treatment. List-style panels (features, results, tools) keep
    // heading + body together so the section title stays on screen.
    const FLASH_HEADING_KEYS = new Set(['challenge', 'approach']);

    this.tuneInScrollTween = gsap.timeline();
    const tl = this.tuneInScrollTween;

    panels.forEach((panel, idx) => {
      const key = panel.dataset.panelKey ?? '';
      const isOutro = key === 'outro';
      const isLast = idx === panels.length - 1;
      const heading = panel.querySelector('.crt-tv__panel-heading') as HTMLElement | null;
      const body = Array.from(panel.children).filter((c) => c !== heading) as HTMLElement[];
      const useFlash = !!heading && FLASH_HEADING_KEYS.has(key);

      // Reveal the panel container (children remain at opacity 0).
      tl.set(panel, { opacity: 1 });

      if (useFlash && heading) {
        // Heading-only mode: body is display:none so the heading is the
        // sole layout item, perfectly centered with no body whitespace.
        tl.add(() => {
          panel.classList.add('is-heading-only');
          panel.classList.remove('is-body-only');
        });
        tl.fromTo(
          heading,
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: TV_HEADING_FLASH_S, ease: 'back.out(2)' }
        );
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
          tl.to(
            body,
            { opacity: 1, duration: TV_TEXT_FADE_S, stagger: 0.06, ease: 'power2.out' }
          );
        }
      } else {
        // Default: fade all children in together (heading + body, or
        // bodyless panels like intro/details/outro). Heading stays on
        // screen with the items for the duration of the section.
        tl.to(
          panel.children,
          { opacity: 1, duration: TV_TEXT_FADE_S, stagger: 0.06, ease: 'power2.out' }
        );
      }

      // Hold so the user can read it. Paragraphs get more time than
      // short panels (tagline / details / lists).
      const holdSeconds = TV_PANEL_HOLD_S[key] ?? TV_SECTION_PAUSE_S_DEFAULT;
      tl.to({}, { duration: holdSeconds });

      // Fade out — but not the outro (it sticks as the terminal frame)
      // and not the last panel (no successor to cross into).
      if (!isOutro && !isLast) {
        tl.to(panel, { opacity: 0, duration: TV_TEXT_FADE_S, ease: 'power2.in' });
      }
    });
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
    if (screenBg) screenBg.src = '/images/title-card_base.webp';
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
  private setTvChannel(index: number): void {
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

    if (safeIndex === 0) {
      // Channel 01: tear down any tune-in and return to the guide.
      this.cancelTuneIn();
      this.flashChannelStatic();
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

    // Update hero image — prefer heroImage, fall back to the composed
    // title card (string legacy form OR object.composed for new form).
    const heroImg = this.projectDetailSection.querySelector<HTMLImageElement>('#project-hero-img');
    if (heroImg) {
      const cardFallback = typeof project.titleCard === 'object'
        ? project.titleCard.composed
        : project.titleCard;
      const heroSrc = project.heroImage || cardFallback || null;
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
