/**
 * ===============================================
 * DATA SERVICE TESTS
 * ===============================================
 * @file src/services/data-service.test.ts
 *
 * Unit tests for DataService functionality.
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { DataService } from './data-service';
import portfolioData from '../../tests/mocks/portfolio.json';

// Mock fetch
global.fetch = vi.fn() as Mock;

const mockVenturesData = {
  ventures: {
    codes: {
      id: 'codes',
      title: 'CODES',
      description: 'Web development',
      fullDescription: 'Full-stack development',
      color: '#00ff41',
      icon: '💻',
      projects: [
        {
          id: 'portfolio',
          title: 'Portfolio Website',
          description: 'Custom portfolio',
          technologies: ['React', 'TypeScript'],
          featured: true
        },
        {
          id: 'ecommerce',
          title: 'E-commerce Platform',
          description: 'Online store',
          technologies: ['Node.js', 'MongoDB'],
          featured: false
        }
      ]
    },
    art: {
      id: 'art',
      title: 'ART',
      description: 'Creative design',
      fullDescription: 'Visual artwork',
      color: '#ff6b6b',
      icon: '🎨',
      projects: [
        {
          id: 'branding',
          title: 'Brand Identity',
          description: 'Logo design',
          technologies: ['Illustrator', 'Photoshop'],
          featured: true
        }
      ]
    }
  },
  navigation: {
    main: [
      { id: 'home', title: 'home', path: '/', eyebrow: '00' }
    ],
    ventures: [
      { id: 'codes', title: 'CODES', path: '/ventures/codes', eyebrow: 'C' }
    ]
  },
  profile: {
    name: 'Test User',
    title: 'Developer',
    location: 'Test City',
    bio: 'Test bio',
    techStack: ['JavaScript', 'TypeScript'],
    tagline: 'Test tagline',
    social: {
      email: 'test@example.com'
    }
  },
  contact: {
    title: 'contact',
    intro: 'Test intro',
    businessSizes: [
      { value: 'Small', label: 'Small Business' }
    ],
    helpOptions: [
      { value: 'CODES', label: 'CODES', id: 'codes-section' }
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
      json: vi.fn().mockResolvedValue(mockVenturesData)
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

  describe('getVentures', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should return all ventures', () => {
      const ventures = dataService.getVentures();

      expect(ventures).toEqual(mockVenturesData.ventures);
      expect(Object.keys(ventures)).toHaveLength(2);
    });

    it('should throw error if data not loaded', () => {
      const uninitializedService = new DataService();

      expect(() => uninitializedService.getVentures()).toThrow('Data not loaded. Call init() first.');
    });
  });

  describe('getVenture', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should return specific venture by id', () => {
      const venture = dataService.getVenture('codes');

      expect(venture).toEqual(mockVenturesData.ventures.codes);
    });

    it('should return null for non-existent venture', () => {
      const venture = dataService.getVenture('nonexistent');

      expect(venture).toBeNull();
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

    it('should include venture information', () => {
      const featured = dataService.getFeaturedProjects();

      expect(featured[0]).toHaveProperty('ventureId', 'codes');
      expect(featured[0]).toHaveProperty('ventureName', 'CODES');
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

      expect(navigation).toEqual(mockVenturesData.navigation);
      expect(navigation.main).toHaveLength(1);
      expect(navigation.ventures).toHaveLength(1);
    });
  });

  describe('getProfile', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should return profile data', () => {
      const profile = dataService.getProfile();

      expect(profile).toEqual(mockVenturesData.profile);
      expect(profile.name).toBe('Test User');
    });
  });

  describe('getContactData', () => {
    beforeEach(async () => {
      await dataService.init();
    });

    it('should return contact data', () => {
      const contact = dataService.getContactData();

      expect(contact).toEqual(mockVenturesData.contact);
      expect(contact.title).toBe('contact');
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
      expect(status.ventureCount).toBe(0);
    });

    it('should return status after initialization', async () => {
      await dataService.init();

      const status = dataService.getStatus();

      expect(status.dataLoaded).toBe(true);
      expect(status.cacheSize).toBe(0);
      expect(status.ventureCount).toBe(2);
    });
  });
});