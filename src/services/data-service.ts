/**
 * ===============================================
 * DATA SERVICE
 * ===============================================
 * @file src/services/data-service.ts
 *
 * Centralized data management service for ventures and site content.
 * Provides typed interfaces and caching for performance.
 */

import { BaseService } from './base-service';

export interface Project {
  id: string;
  title: string;
  description: string;
  fullDescription?: string;
  technologies: string[];
  category: string;
  featured: boolean;
  image?: string;
  demoUrl?: string;
  githubUrl?: string;
}

export interface Category {
  id: string;
  title: string;
  description: string;
}

export interface NavigationItem {
  id: string;
  title: string;
  path: string;
  eyebrow: string;
}

export interface Profile {
  name: string;
  title: string;
  location: string;
  bio: string;
  techStack: string[];
  tagline: string;
  social: {
    github?: string;
    linkedin?: string;
    email?: string;
  };
}

export interface ContactOption {
  value: string;
  label: string;
  id?: string;
  disabled?: boolean;
}

export interface ContactData {
  title: string;
  intro: string;
  businessSizes: ContactOption[];
  helpOptions: ContactOption[];
}

export interface PortfolioData {
  projects: Project[];
  categories: Category[];
  navigation: {
    main: NavigationItem[];
  };
  profile: Profile;
  contact: ContactData;
}

export class DataService extends BaseService {
  getVentures() {
    throw new Error('Method not implemented.');
  }
  getVenture(_id: string) {
    throw new Error('Method not implemented.');
  }
  private data: PortfolioData | null = null;
  private cache = new Map<string, any>();

  constructor() {
    super('DataService');
  }

  override async init(): Promise<void> {
    await super.init();
    await this.loadData();
  }

  /**
   * Load data from portfolio.json
   */
  private async loadData(): Promise<void> {
    try {
      this.log('Loading portfolio data...');
      const response = await fetch('/data/portfolio.json');

      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
      }

      this.data = await response.json();
      this.log('Portfolio data loaded successfully');

      // Clear cache when new data is loaded
      this.cache.clear();

    } catch (error) {
      this.error('Failed to load portfolio data:', error);
      throw error;
    }
  }

  /**
   * Get all projects
   */
  getProjects(): Project[] {
    if (!this.data) {
      throw new Error('Data not loaded. Call init() first.');
    }
    return this.data.projects;
  }

  /**
   * Get specific project by ID
   */
  getProject(id: string): Project | null {
    const projects = this.getProjects();
    return projects.find(project => project.id === id) || null;
  }

  /**
   * Get featured projects
   */
  getFeaturedProjects(): Project[] {
    const cacheKey = 'featured-projects';

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const projects = this.getProjects();
    const featured = projects.filter(project => project.featured);

    this.cache.set(cacheKey, featured);
    return featured;
  }

  /**
   * Get all categories
   */
  getCategories(): Category[] {
    if (!this.data) {
      throw new Error('Data not loaded. Call init() first.');
    }
    return this.data.categories;
  }

  /**
   * Get projects by category
   */
  getProjectsByCategory(categoryId: string): Project[] {
    const cacheKey = `category-${categoryId}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const projects = this.getProjects();
    const categoryProjects = projects.filter(project => project.category === categoryId);

    this.cache.set(cacheKey, categoryProjects);
    return categoryProjects;
  }

  /**
 * Get navigation data
 */
  getNavigation(): { main: NavigationItem[] } {
    if (!this.data) {
      throw new Error('Data not loaded. Call init() first.');
    }
    return this.data.navigation;
  }

  /**
   * Get profile data
   */
  getProfile(): Profile {
    if (!this.data) {
      throw new Error('Data not loaded. Call init() first.');
    }
    return this.data.profile;
  }

  /**
   * Get contact form data
   */
  getContactData(): ContactData {
    if (!this.data) {
      throw new Error('Data not loaded. Call init() first.');
    }
    return this.data.contact;
  }

  /**
   * Search projects
   */
  searchProjects(query: string): Project[] {
    const cacheKey = `search-${query.toLowerCase()}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const projects = this.getProjects();
    const results: Project[] = [];
    const searchTerm = query.toLowerCase();

    projects.forEach(project => {
      const searchableText = [
        project.title,
        project.description,
        project.fullDescription || '',
        ...project.technologies
      ].join(' ').toLowerCase();

      if (searchableText.includes(searchTerm)) {
        results.push(project);
      }
    });

    this.cache.set(cacheKey, results);
    return results;
  }

  /**
   * Get projects by technology
   */
  getProjectsByTechnology(technology: string): Project[] {
    const cacheKey = `tech-${technology.toLowerCase()}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const projects = this.getProjects();
    const results: Project[] = [];

    projects.forEach(project => {
      if (project.technologies.some(tech =>
        tech.toLowerCase().includes(technology.toLowerCase())
      )) {
        results.push(project);
      }
    });

    this.cache.set(cacheKey, results);
    return results;
  }

  /**
   * Reload data (useful for development)
   */
  async reload(): Promise<void> {
    this.log('Reloading data...');
    this.cache.clear();
    await this.loadData();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.log('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  override getStatus() {
    return {
      ...super.getStatus(),
      dataLoaded: !!this.data,
      cacheSize: this.cache.size,
      projectCount: this.data ? this.data.projects.length : 0,
      categoryCount: this.data ? this.data.categories.length : 0
    };
  }
}