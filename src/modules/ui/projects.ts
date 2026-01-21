/**
 * ===============================================
 * PROJECTS MODULE
 * ===============================================
 * @file src/modules/ui/projects.ts
 *
 * Renders Sal Costa-style project cards in the projects section.
 * Shows WIP sign until at least 2 projects are fully documented.
 * Handles project detail page rendering and navigation.
 */

import { BaseModule } from '../core/base';

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
  heroImage: string;
  screenshots: string[];
  liveUrl?: string;
  repoUrl?: string;
  isDocumented: boolean;
}

interface PortfolioData {
  projects: PortfolioProject[];
  categories: Array<{ id: string; name: string; count: number }>;
}

// Minimum documented projects required to show project list
const MIN_DOCUMENTED_PROJECTS = 2;

// Arrow SVG for project cards (Sal Costa style)
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
  private boundHashChangeHandler: (() => void) | null = null;

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

    // Listen for hash changes to handle project detail navigation
    this.boundHashChangeHandler = this.handleHashChange.bind(this);
    window.addEventListener('hashchange', this.boundHashChangeHandler);

    // Check initial hash for project detail
    this.handleHashChange();

    this.log('Initialized');
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
    } else {
      // Keep the existing WIP sign - don't modify
      console.log('[ProjectsModule] Showing WIP sign (less than 2 documented projects)');
    }
  }

  /**
   * Render project cards in Sal Costa style
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
      ecommerce: 'E-Commerce'
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
   * Handle hash changes for project detail navigation
   */
  private handleHashChange(): void {
    const hash = window.location.hash;

    // Check if we're on a project detail page
    const projectMatch = hash.match(/^#\/projects\/(.+)$/);

    if (projectMatch) {
      const slug = projectMatch[1];
      this.showProjectDetail(slug);
    } else if (hash === '#/projects') {
      this.hideProjectDetail();
    }
  }

  /**
   * Show project detail page
   */
  private showProjectDetail(slug: string): void {
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

    // Show project detail section, hide projects list
    this.projectsSection?.classList.remove('page-active');
    this.projectsSection?.classList.add('page-hidden');
    this.projectDetailSection.classList.remove('page-hidden');
    this.projectDetailSection.classList.add('page-active');

    // Dispatch event for page transition module
    window.dispatchEvent(new CustomEvent('router:navigate', {
      detail: { section: 'project-detail', slug }
    }));
  }

  /**
   * Hide project detail and return to projects list
   */
  private hideProjectDetail(): void {
    if (!this.projectDetailSection || !this.projectsSection) return;

    this.currentProjectSlug = null;

    // Update page title
    document.title = 'Projects - No Bhad Codes';

    // Show projects list, hide project detail
    this.projectDetailSection.classList.remove('page-active');
    this.projectDetailSection.classList.add('page-hidden');
    this.projectsSection.classList.remove('page-hidden');
    this.projectsSection.classList.add('page-active');
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

    // Update tools
    const toolsEl = this.projectDetailSection.querySelector('#project-tools');
    if (toolsEl) {
      toolsEl.innerHTML = project.tools
        .map(tool => `<span class="tool-tag">${tool}</span>`)
        .join('');
    }

    // Update description
    const descEl = this.projectDetailSection.querySelector('#project-description');
    if (descEl) {
      descEl.textContent = project.description;
    }

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

    // Reset animations by removing and re-adding classes
    this.resetDetailAnimations();
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
   */
  private goBackToProjects(): void {
    // Add leaving class for exit animation
    const backBtn = document.getElementById('project-back-btn');
    if (backBtn) {
      backBtn.classList.add('leaving');
    }

    // Navigate after brief delay for animation
    setTimeout(() => {
      window.location.hash = '#/projects';
    }, 200);
  }

  /**
   * Clean up module
   */
  protected async onDestroy(): Promise<void> {
    if (this.boundHashChangeHandler) {
      window.removeEventListener('hashchange', this.boundHashChangeHandler);
    }
    this.projectsSection = null;
    this.projectsContent = null;
    this.projectDetailSection = null;
    this.portfolioData = null;
    this.currentProjectSlug = null;
  }
}
