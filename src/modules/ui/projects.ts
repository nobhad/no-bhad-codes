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
import { formatTextWithLineBreaks } from '../../utils/format-utils';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ProjectsModule');

interface PortfolioProject {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  role: string;
  tools: string[];
  year: number;
  status: 'in-progress' | 'completed' | 'planned';
  heroImage: string;
  screenshots: string[];
  liveUrl?: string;
  repoUrl?: string;
  isDocumented: boolean;
  titleCard?: string;
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
    // row-click flow that already calls playTitleCardThenNavigate
    // directly).
    document.addEventListener('projects:tune-in', ((event: CustomEvent) => {
      const slug = event.detail?.slug as string | undefined;
      if (slug) void this.playTitleCardThenNavigate(slug);
    }) as EventListener);

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
      // Returning to projects list - reset detail state
      this.currentProjectSlug = null;
      document.title = 'Projects - No Bhad Codes';
      // Restore the channel-list view on the TV after a tune-in. The
      // playTitleCardThenNavigate sequence faded the channel list to 0
      // and the title-card image to 1; reset both so the user comes
      // back to a "channel guide" view, not a frozen title card.
      const image = document.querySelector('.crt-tv__image') as HTMLImageElement | null;
      const channelList = document.querySelector('.crt-tv__channel-list') as HTMLElement | null;
      const staticOverlay = document.querySelector('.crt-tv__static') as HTMLElement | null;
      if (image) gsap.set(image, { opacity: 0 });
      if (channelList) gsap.set(channelList, { opacity: 1 });
      if (staticOverlay) gsap.set(staticOverlay, { opacity: 0 });
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

    // Render CRT TV and setup hover events (desktop only)
    this.renderCrtTv();
    this.setupCardHoverEvents();

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
          <img class="crt-tv__screen-bg" src="/images/crt-tv-screen.png" alt="" />
          <div class="crt-tv__screen">
            <img class="crt-tv__image" src="" alt="Project preview" />
            <div class="crt-tv__channel-list" data-channel-list></div>
            <div class="crt-tv__static"></div>
            <div class="crt-tv__scanlines"></div>
            <div class="crt-tv__glare"></div>
          </div>
          <img class="crt-tv__frame" src="/images/crt-tv.webp" alt="CRT Television" />
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
    // Each row is a real <button> so it's keyboard-focusable, screen-reader
    // friendly, and clickable to jump straight to the matching detail
    // page. data-index lets setTvChannel highlight the active one.
    const rows = documented
      .map(
        (p, i) => `
        <li class="crt-tv__channel-row-item">
          <button type="button"
                  class="crt-tv__channel-row"
                  data-index="${i}"
                  data-slug="${p.slug}"
                  aria-label="Open ${p.title} project details">
            <span class="crt-tv__channel-title">${p.title}</span>
            <span class="crt-tv__channel-meta">${p.category}</span>
            <span class="crt-tv__channel-meta">${p.year}</span>
          </button>
        </li>`
      )
      .join('');

    container.innerHTML = `
      <h3 class="crt-tv__channel-heading">Projects</h3>
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
      void this.playTitleCardThenNavigate(slug);
    });
  }

  /**
   * "Tune in" sequence — fade the channel list out, swap in the project's
   * title card filling the TV screen with a CRT static flash, hold for a
   * beat so the user sees what's loading, then trigger navigation to
   * project-detail. Called from row clicks AND from the page-transition's
   * Enter-on-projects handler.
   */
  private async playTitleCardThenNavigate(slug: string): Promise<void> {
    if (!this.portfolioData) return;
    const project = this.portfolioData.projects.find((p) => p.slug === slug);
    if (!project) return;

    const screen = document.querySelector('.crt-tv__screen') as HTMLElement | null;
    const image = document.querySelector('.crt-tv__image') as HTMLImageElement | null;
    const channelList = document.querySelector('.crt-tv__channel-list') as HTMLElement | null;
    const staticOverlay = document.querySelector('.crt-tv__static') as HTMLElement | null;

    // Fall back to plain navigation if the TV elements aren't in the DOM
    // (e.g., on mobile where the centered TV layout doesn't render).
    if (!screen || !image || !channelList || !project.titleCard) {
      window.location.hash = `#/projects/${slug}`;
      return;
    }

    gsap.killTweensOf([image, channelList, staticOverlay].filter(Boolean));

    const STATIC_FLASH = 0.9;
    const HOLD_MS = 700;

    image.src = project.titleCard;
    await new Promise<void>((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      // Static flash + channel-list fade out together
      tl.to(staticOverlay, { opacity: STATIC_FLASH, duration: 0.06 }, 0);
      tl.to(channelList, { opacity: 0, duration: 0.06 }, 0);
      // Then static settles and image fades in beneath
      tl.to(image, { opacity: 1, duration: 0.18, ease: 'power2.out' }, 0.08);
      tl.to(staticOverlay, { opacity: 0.18, duration: 0.25, ease: 'power2.out' }, 0.08);
    });

    // Hold the title card on the screen for a beat so the user
    // registers the channel they tuned into.
    await new Promise<void>((resolve) => setTimeout(resolve, HOLD_MS));

    // Now hand off to navigation. The slide transition takes over from
    // here. After the user comes BACK to projects later, restore the
    // channel-list view (handled in handlePageChanged below).
    window.location.hash = `#/projects/${slug}`;
  }

  /**
   * Setup hover events for project cards to trigger TV display
   */
  private setupCardHoverEvents(): void {
    if (!this.projectsContent || !this.portfolioData) return;

    const cards = this.projectsContent.querySelectorAll('.work-card');

    cards.forEach((card) => {
      const projectId = (card as HTMLElement).dataset.projectId;
      const project = this.portfolioData?.projects.find((p) => p.id === projectId);

      card.addEventListener('mouseenter', () => {
        if (project?.titleCard) {
          this.changeTvChannel(project.titleCard);
        }
      });

      card.addEventListener('mouseleave', () => {
        this.turnOffTv();
      });
    });
  }

  /**
   * Show a specific project on the CRT TV by index in the documented list.
   * Called from page-transition.ts via the 'projects:set-tv-channel' event
   * — page-transition owns the index because it gates the boundary-exit
   * navigation (scroll past last → contact, scroll above first → intro).
   */
  private setTvChannel(index: number): void {
    if (!this.portfolioData) return;
    const documented = this.portfolioData.projects.filter((p) => p.isDocumented);
    if (documented.length === 0) return;

    const safeIndex = Math.max(0, Math.min(index, documented.length - 1));
    const project = documented[safeIndex];
    if (!project) return;

    if (project.titleCard) this.changeTvChannel(project.titleCard);

    // Highlight the matching channel-list row inside the TV screen so
    // the user sees which project is "tuned in".
    const rows = document.querySelectorAll<HTMLElement>('.crt-tv__channel-row');
    rows.forEach((row) => {
      row.classList.toggle('is-active', Number(row.dataset.index) === safeIndex);
    });

    // Keep the (now-hidden) work-card list in sync too — preserves the
    // existing card click handlers for keyboard / screen-reader users.
    const cards = this.projectsContent?.querySelectorAll('.work-card');
    cards?.forEach((card) => {
      card.classList.toggle(
        'is-active',
        (card as HTMLElement).dataset.projectId === project.id
      );
    });
  }

  /**
   * CRT channel change effect - flicker static then show image
   */
  private changeTvChannel(imageSrc: string): void {
    const image = document.querySelector('.crt-tv__image') as HTMLImageElement;
    const staticOverlay = document.querySelector('.crt-tv__static');

    if (!image || !staticOverlay) return;

    // Kill any existing animation
    gsap.killTweensOf([image, staticOverlay]);

    // CRT channel change effect
    // Channel-change effect — flash the static overlay then fade it back
    // down. The TV screen now shows the channel-list text underneath
    // (not the title-card image), so we just paint the static layer
    // over the list briefly to sell the channel-flip without ever
    // bringing the image to opacity 1.
    const tl = gsap.timeline();
    const STATIC_FLASH_OPACITY = 0.8;
    const STATIC_GRAIN_OPACITY = 0.18;

    // Keep image src updated in case anything else reads it, but it
    // stays at opacity 0 — the channel list owns the visual surface.
    image.src = imageSrc;
    gsap.set(image, { opacity: 0 });

    tl.to(staticOverlay, { opacity: STATIC_FLASH_OPACITY, duration: 0.05 }).to(
      staticOverlay,
      {
        opacity: STATIC_GRAIN_OPACITY,
        duration: 0.3,
        ease: 'power2.out'
      },
      '+=0.05'
    );
  }

  /**
   * CRT turn-off effect - shrink vertically then fade
   */
  private turnOffTv(): void {
    const image = document.querySelector('.crt-tv__image') as HTMLImageElement;
    const staticOverlay = document.querySelector('.crt-tv__static');

    if (!image || !staticOverlay) return;

    gsap.killTweensOf([image, staticOverlay]);

    // CRT turn-off effect
    const tl = gsap.timeline();
    tl.to(image, {
      opacity: 0,
      scaleY: 0.01,
      duration: 0.15,
      ease: 'power2.in',
      onComplete: () => {
        gsap.set(image, { scaleY: 1 });
      }
    }).to(staticOverlay, { opacity: 0, duration: 0.2, ease: 'power2.out' }, '<');
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

    // Update hero image — prefer heroImage, fall back to titleCard
    const heroImg = this.projectDetailSection.querySelector<HTMLImageElement>('#project-hero-img');
    if (heroImg) {
      const heroSrc = project.heroImage || project.titleCard || null;
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
