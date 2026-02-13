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

    // Listen for page-changed events from PageTransitionModule
    // This replaces direct hash change handling to avoid race conditions
    window.addEventListener('page-changed', this.handlePageChanged.bind(this) as EventListener);

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
      // Just render the content - PageTransitionModule handles visibility
      this.renderProjectDetailForSlug(slug);
    }
  }

  /**
   * Handle page-changed events from PageTransitionModule
   */
  private handlePageChanged(event: CustomEvent): void {
    const { to } = event.detail || {};

    if (to === 'project-detail') {
      // Extract slug from current hash and render content
      const hash = window.location.hash;
      const projectMatch = hash.match(/^#\/projects\/(.+)$/);

      if (projectMatch) {
        const slug = projectMatch[1];
        this.renderProjectDetailForSlug(slug);
      }
    } else if (to === 'projects') {
      // Returning to projects list - reset detail state
      this.currentProjectSlug = null;
      document.title = 'Projects - No Bhad Codes';
    }
  }

  /**
   * Render project detail content for a given slug
   * Does NOT manage page visibility - only content rendering
   */
  private renderProjectDetailForSlug(slug: string): void {
    if (!this.portfolioData || !this.projectDetailSection) return;

    const project = this.portfolioData.projects.find(p => p.slug === slug);
    if (!project) {
      console.warn('[ProjectsModule] Project not found:', slug);
      // Navigate back to projects list
      window.location.hash = '#/projects';
      return;
    }

    this.currentProjectSlug = slug;

    // Populate project detail content
    this.renderProjectDetail(project);

    // Update page title
    document.title = `${project.title} - No Bhad Codes`;
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
      console.error('[ProjectsModule] Failed to load portfolio data:', error);
      this.portfolioData = { projects: [], categories: [] };
    }
  }

  /**
   * Render projects section based on documented project count
   */
  private render(): void {
    if (!this.projectsContent || !this.portfolioData) return;

    const documentedProjects = this.portfolioData.projects.filter(p => p.isDocumented);
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
  }

  /**
   * Render CRT TV component using actual PNG image
   */
  private renderCrtTv(): void {
    if (!this.projectsContent) return;

    // Check if TV already exists
    if (this.projectsContent.querySelector('.crt-tv')) return;

    const workWrapper = this.projectsContent.querySelector('.work-half-wrapper');
    const heading = this.projectsContent.querySelector('h2');
    const hr = this.projectsContent.querySelector('hr, .heading-divider');
    if (!workWrapper) return;

    // Create a column wrapper for heading + hr + cards
    const listColumn = document.createElement('div');
    listColumn.className = 'projects-list-column';

    // Create the flex row container
    const flexRow = document.createElement('div');
    flexRow.className = 'projects-flex-row';

    // Insert flex row where work wrapper was
    workWrapper.parentNode?.insertBefore(flexRow, workWrapper);

    // Move heading and hr into list column
    if (heading) listColumn.appendChild(heading);
    if (hr) listColumn.appendChild(hr);
    listColumn.appendChild(workWrapper);

    // Add list column to flex row
    flexRow.appendChild(listColumn);

    // Add the TV to the flex row
    const tvHtml = `
      <div class="crt-tv">
        <div class="crt-tv__wrapper">
          <img class="crt-tv__screen-bg" src="/images/crt-tv-screen.png" alt="" />
          <div class="crt-tv__screen">
            <img class="crt-tv__image" src="" alt="Project preview" />
            <div class="crt-tv__static"></div>
            <div class="crt-tv__scanlines"></div>
            <div class="crt-tv__glare"></div>
          </div>
          <img class="crt-tv__frame" src="/images/crt-tv.png" alt="CRT Television" />
        </div>
      </div>
    `;

    flexRow.insertAdjacentHTML('beforeend', tvHtml);
  }

  /**
   * Setup hover events for project cards to trigger TV display
   */
  private setupCardHoverEvents(): void {
    if (!this.projectsContent || !this.portfolioData) return;

    const cards = this.projectsContent.querySelectorAll('.work-card');

    cards.forEach(card => {
      const projectId = (card as HTMLElement).dataset.projectId;
      const project = this.portfolioData?.projects.find(p => p.id === projectId);

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
   * CRT channel change effect - flicker static then show image
   */
  private changeTvChannel(imageSrc: string): void {
    const image = document.querySelector('.crt-tv__image') as HTMLImageElement;
    const staticOverlay = document.querySelector('.crt-tv__static');

    if (!image || !staticOverlay) return;

    // Kill any existing animation
    gsap.killTweensOf([image, staticOverlay]);

    // CRT channel change effect
    const tl = gsap.timeline();

    tl.to(image, { opacity: 0, duration: 0.05 })
      .to(staticOverlay, { opacity: 0.8, duration: 0.05 }, '<')
      .call(() => { image.src = imageSrc; })
      .to(staticOverlay, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.out'
      }, '+=0.1')
      .to(image, {
        opacity: 1,
        duration: 0.2,
        ease: 'power2.out'
      }, '<');
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
    gsap.to(image, {
      opacity: 0,
      scaleY: 0.01,
      duration: 0.15,
      ease: 'power2.in',
      onComplete: () => {
        gsap.set(image, { scaleY: 1 });
      }
    });
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

    cards.forEach(card => {
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
  private renderProjectDetail(project: PortfolioProject): void {
    if (!this.projectDetailSection) return;

    // Update hero image
    const heroImg = this.projectDetailSection.querySelector<HTMLImageElement>('#project-hero-img');
    if (heroImg) {
      if (project.heroImage) {
        heroImg.src = project.heroImage;
        heroImg.alt = `${project.title} hero image`;
        heroImg.classList.remove('placeholder');
      } else {
        // Placeholder for missing hero
        heroImg.src = '/images/project-placeholder.svg';
        heroImg.alt = `${project.title} - image coming soon`;
        heroImg.classList.add('placeholder');
      }
    }

    // Update title
    const titleEl = this.projectDetailSection.querySelector('#project-title');
    if (titleEl) {
      titleEl.textContent = project.title;
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
        .map(tool => `<span class="tool-tag">${tool}</span>`)
        .join('');
    }

    // Update description (use innerHTML with sanitized line breaks)
    const descEl = this.projectDetailSection.querySelector('#project-description');
    if (descEl) {
      descEl.innerHTML = formatTextWithLineBreaks(project.description);
    }

    // Update case study sections
    this.renderCaseStudySections(project);

    // Update screenshots
    const infoEl = this.projectDetailSection.querySelector('#project-info');
    if (infoEl) {
      if (project.screenshots && project.screenshots.length > 0) {
        infoEl.innerHTML = project.screenshots
          .map((screenshot, index) => `
            <figure>
              <img src="${screenshot}" alt="${project.title} screenshot ${index + 1}" />
            </figure>
          `)
          .join('');
      } else {
        infoEl.innerHTML = '';
      }
    }

    // Update links
    const linksEl = this.projectDetailSection.querySelector('#project-links');
    if (linksEl) {
      const links: string[] = [];

      if (project.liveUrl) {
        links.push(`
          <a href="${project.liveUrl}" target="_blank" rel="noopener noreferrer">
            ${EXTERNAL_LINK_SVG}
            View Live
          </a>
        `);
      }

      if (project.repoUrl) {
        links.push(`
          <a href="${project.repoUrl}" target="_blank" rel="noopener noreferrer">
            ${GITHUB_SVG}
            Source Code
          </a>
        `);
      }

      linksEl.innerHTML = links.join('');
    }

    // Update next/prev navigation
    this.renderProjectNavigation(project);

    // Reset animations by removing and re-adding classes
    this.resetDetailAnimations();
  }

  /**
   * Format status for display
   */
  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'in-progress': 'In Progress',
      'completed': 'Completed',
      'planned': 'Planned'
    };
    return statusMap[status] || status;
  }

  /**
   * Render case study sections (challenge, approach, results, features)
   */
  private renderCaseStudySections(project: PortfolioProject): void {
    if (!this.projectDetailSection) return;

    // Challenge section
    const challengeSection = this.projectDetailSection.querySelector('#project-challenge-section');
    const challengeEl = this.projectDetailSection.querySelector('#project-challenge');
    if (challengeSection && challengeEl) {
      if (project.challenge) {
        challengeEl.textContent = project.challenge;
        (challengeSection as HTMLElement).style.display = '';
      } else {
        (challengeSection as HTMLElement).style.display = 'none';
      }
    }

    // Approach section
    const approachSection = this.projectDetailSection.querySelector('#project-approach-section');
    const approachEl = this.projectDetailSection.querySelector('#project-approach');
    if (approachSection && approachEl) {
      if (project.approach) {
        approachEl.textContent = project.approach;
        (approachSection as HTMLElement).style.display = '';
      } else {
        (approachSection as HTMLElement).style.display = 'none';
      }
    }

    // Key Features section
    const featuresSection = this.projectDetailSection.querySelector('#project-features-section');
    const featuresEl = this.projectDetailSection.querySelector('#project-features');
    if (featuresSection && featuresEl) {
      if (project.keyFeatures && project.keyFeatures.length > 0) {
        featuresEl.innerHTML = project.keyFeatures
          .map(feature => `<li>${feature}</li>`)
          .join('');
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
        resultsEl.innerHTML = project.results
          .map(result => `<li>${result}</li>`)
          .join('');
        (resultsSection as HTMLElement).style.display = '';
      } else {
        (resultsSection as HTMLElement).style.display = 'none';
      }
    }
  }

  /**
   * Render next/previous project navigation
   */
  private renderProjectNavigation(currentProject: PortfolioProject): void {
    if (!this.projectDetailSection || !this.portfolioData) return;

    const documentedProjects = this.portfolioData.projects.filter(p => p.isDocumented);
    const currentIndex = documentedProjects.findIndex(p => p.id === currentProject.id);

    const prevLink = this.projectDetailSection.querySelector('#project-prev') as HTMLAnchorElement;
    const nextLink = this.projectDetailSection.querySelector('#project-next') as HTMLAnchorElement;
    const prevTitle = this.projectDetailSection.querySelector('#project-prev-title');
    const nextTitle = this.projectDetailSection.querySelector('#project-next-title');

    // Previous project (wrap around to end if at beginning)
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : documentedProjects.length - 1;
    const prevProject = documentedProjects[prevIndex];

    if (prevLink && prevTitle && prevProject && prevProject.id !== currentProject.id) {
      prevLink.href = `#/projects/${prevProject.slug}`;
      prevTitle.textContent = prevProject.title;
      prevLink.style.visibility = 'visible';

      // Add click handler to navigate without page reload
      prevLink.onclick = (e) => {
        e.preventDefault();
        window.history.pushState(null, '', `#/projects/${prevProject.slug}`);
        this.renderProjectDetailForSlug(prevProject.slug);
        // Scroll to top of project detail
        this.projectDetailSection?.scrollTo({ top: 0, behavior: 'smooth' });
      };
    } else if (prevLink) {
      prevLink.style.visibility = 'hidden';
      prevLink.onclick = null;
    }

    // Next project (wrap around to beginning if at end)
    const nextIndex = currentIndex < documentedProjects.length - 1 ? currentIndex + 1 : 0;
    const nextProject = documentedProjects[nextIndex];

    if (nextLink && nextTitle && nextProject && nextProject.id !== currentProject.id) {
      nextLink.href = `#/projects/${nextProject.slug}`;
      nextTitle.textContent = nextProject.title;
      nextLink.style.visibility = 'visible';

      // Add click handler to navigate without page reload
      nextLink.onclick = (e) => {
        e.preventDefault();
        window.history.pushState(null, '', `#/projects/${nextProject.slug}`);
        this.renderProjectDetailForSlug(nextProject.slug);
        // Scroll to top of project detail
        this.projectDetailSection?.scrollTo({ top: 0, behavior: 'smooth' });
      };
    } else if (nextLink) {
      nextLink.style.visibility = 'hidden';
      nextLink.onclick = null;
    }
  }

  /**
   * Reset animations for project detail elements
   */
  private resetDetailAnimations(): void {
    if (!this.projectDetailSection) return;

    const animatedElements = this.projectDetailSection.querySelectorAll(
      '.worksub-header, .worksub-intro, .worksub-info, .worksub-links, .back-button'
    );

    animatedElements.forEach(el => {
      // Force reflow to restart animations
      el.classList.remove('leaving');
      void (el as HTMLElement).offsetWidth;
    });
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
    this.projectsSection = null;
    this.projectsContent = null;
    this.projectDetailSection = null;
    this.portfolioData = null;
    this.currentProjectSlug = null;
  }
}
