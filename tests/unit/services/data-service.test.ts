/**
 * ===============================================
 * DATA SERVICE TESTS
 * ===============================================
 * @file src/services/data-service.test.ts
 *
 * Unit tests for DataService functionality.
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { DataService } from '@/services/data-service';
import portfolioData from '@tests/mocks/portfolio.json';

// Mock fetch
global.fetch = vi.fn() as Mock;

const mockPortfolioData = {
  projects: [
    {
      id: 'portfolio',
      title: 'Portfolio Website',
      description: 'Custom portfolio',
      technologies: ['React', 'TypeScript'],
      featured: true,
      category: 'codes'
    },
    {
      id: 'ecommerce',
      title: 'E-commerce Platform',
      description: 'Online store',
      technologies: ['Node.js', 'MongoDB'],
      featured: false,
      category: 'codes'
    },
    {
      id: 'branding',
      title: 'Brand Identity',
      description: 'Logo design',
      technologies: ['Illustrator', 'Photoshop'],
      featured: true,
      category: 'art'
    }
  ],
  categories: [
    {
      id: 'codes',
      title: 'CODES',
      description: 'Web development',
      fullDescription: 'Full-stack development',
      color: '#00ff41',
      icon: '💻'
    },
    {
      id: 'art',
      title: 'ART',
      description: 'Creative design',
      fullDescription: 'Visual artwork',
      color: '#ff6b6b',
      icon: '🎨'
    }
  ],
  navigation: {
    main: [
      { id: 'home', title: 'home', path: '/', eyebrow: '00' }
    ]
  }
};

describe('DataService', () => {
  let dataService: DataService;

  beforeEach(() => {
    dataService = new DataService();
    vi.clearAllMocks();

    // Mock successful fetch response
    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockPortfolioData)
    });
  });

  describe('init', () => {
    it('should load data successfully', async () => {
      await dataService.init();

      expect(fetch).toHaveBeenCalledWith('/data/portfolio.json');
      expect(dataService.getStatus().dataLoaded).toBe(true);
    });

    it('should handle fetch errors', async () => {
      (fetch as Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(dataService.init()).rejects.toThrow('Failed to load data: 404 Not Found');
    });

    it('should handle network errors', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Network error'));

      await expect(dataService.init()).rejects.toThrow('Network error');
    });
  });

  describe('getProjects', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should return all projects', () => {
      const projects = dataService.getProjects();

      expect(projects).toEqual(mockPortfolioData.projects);
      expect(projects).toHaveLength(3);
    });

    it('should throw error if data not loaded', () => {
      const uninitializedService = new DataService();

      expect(() => uninitializedService.getProjects()).toThrow('Data not loaded. Call init() first.');
    });
  });

  describe('getProject', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should return specific project by id', () => {
      const project = dataService.getProject('portfolio');

      expect(project).toEqual(mockPortfolioData.projects[0]);
    });

    it('should return null for non-existent project', () => {
      const project = dataService.getProject('nonexistent');

      expect(project).toBeNull();
    });
  });

  describe('getFeaturedProjects', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should return only featured projects', () => {
      const featured = dataService.getFeaturedProjects();

      expect(featured).toHaveLength(2);
      expect(featured.every(p => p.featured)).toBe(true);
      expect(featured.map(p => p.id)).toEqual(['portfolio', 'branding']);
    });

    it('should include category information', () => {
      const featured = dataService.getFeaturedProjects();

      expect(featured[0]).toHaveProperty('category', 'codes');
      expect(featured[1]).toHaveProperty('category', 'art');
    });

    it('should use cache on subsequent calls', () => {
      const first = dataService.getFeaturedProjects();
      const second = dataService.getFeaturedProjects();

      expect(first).toBe(second); // Same reference = cached
    });
  });

  describe('getNavigation', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should return navigation data', () => {
      const navigation = dataService.getNavigation();

      expect(navigation).toEqual(mockPortfolioData.navigation);
      expect(navigation.main).toHaveLength(1);
    });
  });

  describe('searchProjects', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should find projects by title', () => {
      const results = dataService.searchProjects('Portfolio');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Portfolio Website');
    });

    it('should find projects by technology', () => {
      const results = dataService.searchProjects('React');

      expect(results).toHaveLength(1);
      expect(results[0].technologies).toContain('React');
    });

    it('should be case insensitive', () => {
      const results = dataService.searchProjects('PORTFOLIO');

      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', () => {
      const results = dataService.searchProjects('nonexistent');

      expect(results).toHaveLength(0);
    });

    it('should use cache for repeated searches', () => {
      const first = dataService.searchProjects('portfolio');
      const second = dataService.searchProjects('portfolio');

      expect(first).toBe(second);
    });
  });

  describe('getProjectsByTechnology', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should find projects by exact technology match', () => {
      const results = dataService.getProjectsByTechnology('React');

      expect(results).toHaveLength(1);
      expect(results[0].technologies).toContain('React');
    });

    it('should find projects by partial technology match', () => {
      const results = dataService.getProjectsByTechnology('Script');

      expect(results).toHaveLength(1);
      expect(results[0].technologies).toContain('TypeScript');
    });

    it('should be case insensitive', () => {
      const results = dataService.getProjectsByTechnology('react');

      expect(results).toHaveLength(1);
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should clear cache', () => {
      // Populate cache
      dataService.getFeaturedProjects();
      dataService.searchProjects('test');

      expect(dataService.getCacheStats().size).toBeGreaterThan(0);

      dataService.clearCache();

      expect(dataService.getCacheStats().size).toBe(0);
    });

    it('should provide cache statistics', () => {
      dataService.getFeaturedProjects();
      dataService.searchProjects('test');

      const stats = dataService.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('featured-projects');
      expect(stats.keys).toContain('search-test');
    });
  });

  describe('reload', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should reload data and clear cache', async () => {
      // Populate cache
      dataService.getFeaturedProjects();
      expect(dataService.getCacheStats().size).toBe(1);

      await dataService.reload();

      expect(dataService.getCacheStats().size).toBe(0);
      expect(fetch).toHaveBeenCalledTimes(2); // init + reload
    });
  });

  describe('getStatus', () => {
    it('should return status before initialization', () => {
      const status = dataService.getStatus();

      expect(status.dataLoaded).toBe(false);
      expect(status.cacheSize).toBe(0);
      expect(status.projectCount).toBe(0);
      expect(status.categoryCount).toBe(0);
    });

    it('should return status after initialization', async () => {
      await dataService.init();

      const status = dataService.getStatus();

      expect(status.dataLoaded).toBe(true);
      expect(status.cacheSize).toBe(0);
      expect(status.projectCount).toBe(3);
      expect(status.categoryCount).toBe(2);
    });
  });
});