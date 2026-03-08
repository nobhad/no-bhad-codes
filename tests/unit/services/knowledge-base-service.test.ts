/**
 * ===============================================
 * UNIT TESTS - KNOWLEDGE BASE SERVICE
 * ===============================================
 * @file tests/unit/services/knowledge-base-service.test.ts
 *
 * Tests for knowledge base service including:
 * - Category CRUD operations
 * - Article CRUD operations
 * - Search and logging
 * - Feedback submission
 * - Stats retrieval
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(null),
    getUserIdByEmailOrName: vi.fn().mockResolvedValue(null)
  }
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import after mocks
import { knowledgeBaseService } from '../../../server/services/knowledge-base-service';
import { userService } from '../../../server/services/user-service';

const mockCategory = {
  id: 1,
  name: 'Getting Started',
  slug: 'getting-started',
  description: 'Beginner articles',
  icon: 'book',
  color: '#6b7280',
  sort_order: 0,
  is_active: true,
  article_count: 3,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
};

const mockArticle = {
  id: 1,
  category_id: 1,
  category_name: 'Getting Started',
  category_slug: 'getting-started',
  title: 'Introduction',
  slug: 'introduction',
  summary: 'An intro article',
  content: 'Content here',
  keywords: 'intro,start',
  is_featured: false,
  is_published: true,
  view_count: 10,
  helpful_count: 5,
  not_helpful_count: 1,
  sort_order: 0,
  author_email: 'author@example.com',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  published_at: '2026-01-01T00:00:00Z'
};

describe('KnowledgeBaseService - Categories', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getCategories', () => {
    it('returns active categories by default', async () => {
      mockDb.all.mockResolvedValueOnce([mockCategory]);

      const result = await knowledgeBaseService.getCategories();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ name: 'Getting Started' });
      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).toContain('WHERE c.is_active = 1');
    });

    it('returns all categories when includeInactive is true', async () => {
      mockDb.all.mockResolvedValueOnce([mockCategory]);

      await knowledgeBaseService.getCategories(true);

      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).not.toContain('WHERE c.is_active = 1');
    });

    it('returns empty array when no categories exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await knowledgeBaseService.getCategories();

      expect(result).toHaveLength(0);
    });
  });

  describe('getCategoryBySlug', () => {
    it('returns a category for a valid slug', async () => {
      mockDb.get.mockResolvedValueOnce(mockCategory);

      const result = await knowledgeBaseService.getCategoryBySlug('getting-started');

      expect(result).toMatchObject({ slug: 'getting-started' });
      expect(mockDb.get).toHaveBeenCalledWith(expect.stringContaining('WHERE c.slug = ?'), ['getting-started']);
    });

    it('returns null when category not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await knowledgeBaseService.getCategoryBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getCategoryById', () => {
    it('returns a category for a valid id', async () => {
      mockDb.get.mockResolvedValueOnce(mockCategory);

      const result = await knowledgeBaseService.getCategoryById(1);

      expect(result).toMatchObject({ id: 1 });
      expect(mockDb.get).toHaveBeenCalledWith(expect.stringContaining('kb_categories WHERE id = ?'), [1]);
    });

    it('returns null when category not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await knowledgeBaseService.getCategoryById(999);

      expect(result).toBeNull();
    });
  });

  describe('createCategory', () => {
    it('creates a category and returns it', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(mockCategory);

      const result = await knowledgeBaseService.createCategory({
        name: 'Getting Started',
        slug: 'getting-started',
        description: 'Beginner articles'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO kb_categories'),
        expect.arrayContaining(['Getting Started', 'getting-started', 'Beginner articles'])
      );
      expect(result).toMatchObject({ name: 'Getting Started' });
    });

    it('uses defaults for optional icon and color', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce({ ...mockCategory, id: 2 });

      await knowledgeBaseService.createCategory({ name: 'FAQ', slug: 'faq' });

      const callArgs = mockDb.run.mock.calls[0][1] as unknown[];
      expect(callArgs[3]).toBe('book');   // default icon
      expect(callArgs[4]).toBe('#6b7280'); // default color
      expect(callArgs[5]).toBe(0);         // default sort_order
    });
  });

  describe('updateCategory', () => {
    it('updates and returns the category', async () => {
      // First call: getCategoryById to check existence
      mockDb.get.mockResolvedValueOnce(mockCategory);
      // run call for update
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      // Second call: getCategoryById after update
      mockDb.get.mockResolvedValueOnce({ ...mockCategory, name: 'Updated Name' });

      const result = await knowledgeBaseService.updateCategory(1, { name: 'Updated Name' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE kb_categories'),
        expect.any(Array)
      );
      expect(result).toMatchObject({ name: 'Updated Name' });
    });

    it('returns null when category does not exist', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await knowledgeBaseService.updateCategory(999, { name: 'New Name' });

      expect(result).toBeNull();
      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe('deleteCategory', () => {
    it('deletes a category by id', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await knowledgeBaseService.deleteCategory(1);

      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM kb_categories WHERE id = ?', [1]);
    });
  });
});

describe('KnowledgeBaseService - Articles', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    vi.mocked(userService.getUserIdByEmail).mockResolvedValue(null);
  });

  describe('getArticlesByCategory', () => {
    it('returns published articles for a category slug', async () => {
      mockDb.all.mockResolvedValueOnce([mockArticle]);

      const result = await knowledgeBaseService.getArticlesByCategory('getting-started');

      expect(result).toHaveLength(1);
      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).toContain('AND a.is_published = 1');
    });

    it('returns all articles when publishedOnly is false', async () => {
      mockDb.all.mockResolvedValueOnce([mockArticle]);

      await knowledgeBaseService.getArticlesByCategory('getting-started', false);

      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).not.toContain('AND a.is_published = 1');
    });
  });

  describe('getFeaturedArticles', () => {
    it('returns featured articles with default limit', async () => {
      mockDb.all.mockResolvedValueOnce([mockArticle]);

      const result = await knowledgeBaseService.getFeaturedArticles();

      expect(result).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('is_featured = 1'),
        [5]
      );
    });

    it('respects custom limit', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await knowledgeBaseService.getFeaturedArticles(3);

      expect(mockDb.all).toHaveBeenCalledWith(expect.any(String), [3]);
    });
  });

  describe('getArticleBySlug', () => {
    it('returns an article for matching slugs', async () => {
      mockDb.get.mockResolvedValueOnce(mockArticle);

      const result = await knowledgeBaseService.getArticleBySlug('getting-started', 'introduction');

      expect(result).toMatchObject({ slug: 'introduction' });
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE c.slug = ? AND a.slug = ?'),
        ['getting-started', 'introduction']
      );
    });

    it('returns null when not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await knowledgeBaseService.getArticleBySlug('cat', 'missing');

      expect(result).toBeNull();
    });
  });

  describe('getArticleById', () => {
    it('returns an article by id', async () => {
      mockDb.get.mockResolvedValueOnce(mockArticle);

      const result = await knowledgeBaseService.getArticleById(1);

      expect(result).toMatchObject({ id: 1 });
    });

    it('returns null when not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await knowledgeBaseService.getArticleById(999);

      expect(result).toBeNull();
    });
  });

  describe('createArticle', () => {
    it('creates a published article and returns it', async () => {
      vi.mocked(userService.getUserIdByEmail).mockResolvedValueOnce(42);
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(mockArticle);

      const result = await knowledgeBaseService.createArticle({
        category_id: 1,
        title: 'Introduction',
        slug: 'introduction',
        content: 'Content here',
        author_email: 'author@example.com'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO kb_articles'),
        expect.arrayContaining([1, 'Introduction', 'introduction', 'Content here'])
      );
      expect(result).toMatchObject({ title: 'Introduction' });
    });

    it('creates an unpublished article when is_published is false', async () => {
      vi.mocked(userService.getUserIdByEmail).mockResolvedValueOnce(null);
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce({ ...mockArticle, is_published: false });

      await knowledgeBaseService.createArticle({
        category_id: 1,
        title: 'Draft',
        slug: 'draft',
        content: 'Draft content',
        is_published: false
      });

      // 8th param (index 7) is is_published value
      const runArgs = mockDb.run.mock.calls[0][1] as unknown[];
      expect(runArgs[7]).toBe(0); // is_published = false -> 0
      expect(runArgs[10]).toBeNull(); // published_at = null for unpublished
    });
  });

  describe('updateArticle', () => {
    it('updates and returns the article', async () => {
      mockDb.get.mockResolvedValueOnce(mockArticle);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce({ ...mockArticle, title: 'Updated Title' });

      const result = await knowledgeBaseService.updateArticle(1, { title: 'Updated Title' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE kb_articles'),
        expect.any(Array)
      );
      expect(result).toMatchObject({ title: 'Updated Title' });
    });

    it('returns null when article not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await knowledgeBaseService.updateArticle(999, { title: 'X' });

      expect(result).toBeNull();
    });

    it('sets published_at when publishing for the first time', async () => {
      const unpublishedArticle = { ...mockArticle, is_published: false, published_at: undefined };
      mockDb.get.mockResolvedValueOnce(unpublishedArticle);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce({ ...unpublishedArticle, is_published: true });

      await knowledgeBaseService.updateArticle(1, { is_published: true });

      const runArgs = mockDb.run.mock.calls[0][1] as unknown[];
      // published_at should be set (index 9)
      expect(runArgs[9]).toBeTruthy();
    });
  });

  describe('deleteArticle', () => {
    it('deletes an article by id', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await knowledgeBaseService.deleteArticle(1);

      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM kb_articles WHERE id = ?', [1]);
    });
  });

  describe('incrementViewCount', () => {
    it('increments the view count for an article', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await knowledgeBaseService.incrementViewCount(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE kb_articles SET view_count = view_count + 1 WHERE id = ?',
        [1]
      );
    });
  });
});

describe('KnowledgeBaseService - Search', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('searchArticles', () => {
    it('returns matching articles and logs the search', async () => {
      mockDb.all.mockResolvedValueOnce([mockArticle]);
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // logSearch insert

      const result = await knowledgeBaseService.searchArticles('intro');

      expect(result).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.arrayContaining(['%intro%'])
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO kb_search_log'),
        expect.arrayContaining(['intro', 1])
      );
    });

    it('respects custom limit', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({});

      await knowledgeBaseService.searchArticles('test', { limit: 5 });

      const callArgs = mockDb.all.mock.calls[0][1] as unknown[];
      expect(callArgs[callArgs.length - 1]).toBe(5);
    });

    it('logs search with userId and userType when provided', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({});

      await knowledgeBaseService.searchArticles('query', { userId: 7, userType: 'admin' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO kb_search_log'),
        expect.arrayContaining(['query', 0, 7, 'admin'])
      );
    });
  });

  describe('logSearch', () => {
    it('inserts a search log entry', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await knowledgeBaseService.logSearch('my query', 4, 3, 'client');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO kb_search_log'),
        ['my query', 4, 3, 'client']
      );
    });

    it('uses anonymous as default userType', async () => {
      mockDb.run.mockResolvedValueOnce({});

      await knowledgeBaseService.logSearch('term', 0);

      const callArgs = mockDb.run.mock.calls[0][1] as unknown[];
      expect(callArgs[3]).toBe('anonymous');
    });
  });

  describe('recordSearchClick', () => {
    it('updates the most recent search log with the clicked article', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await knowledgeBaseService.recordSearchClick(5);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE kb_search_log'),
        [5]
      );
    });
  });
});

describe('KnowledgeBaseService - Feedback', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('submitFeedback', () => {
    it('inserts feedback and increments helpful_count when helpful', async () => {
      mockDb.run.mockResolvedValueOnce({}); // insert feedback
      mockDb.run.mockResolvedValueOnce({}); // increment helpful_count

      await knowledgeBaseService.submitFeedback({
        articleId: 1,
        isHelpful: true,
        userId: 10,
        userType: 'client',
        comment: 'Great!'
      });

      expect(mockDb.run).toHaveBeenNthCalledWith(1,
        expect.stringContaining('INSERT INTO kb_article_feedback'),
        expect.arrayContaining([1, 10, 'client', 1, 'Great!'])
      );
      expect(mockDb.run).toHaveBeenNthCalledWith(2,
        expect.stringContaining('helpful_count = helpful_count + 1'),
        [1]
      );
    });

    it('inserts feedback and increments not_helpful_count when not helpful', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.run.mockResolvedValueOnce({});

      await knowledgeBaseService.submitFeedback({
        articleId: 2,
        isHelpful: false
      });

      expect(mockDb.run).toHaveBeenNthCalledWith(2,
        expect.stringContaining('not_helpful_count = not_helpful_count + 1'),
        [2]
      );
    });

    it('uses defaults for optional fields', async () => {
      mockDb.run.mockResolvedValue({});

      await knowledgeBaseService.submitFeedback({ articleId: 3, isHelpful: true });

      const insertArgs = mockDb.run.mock.calls[0][1] as unknown[];
      expect(insertArgs[1]).toBeNull();       // userId defaults to null
      expect(insertArgs[2]).toBe('anonymous'); // userType defaults to 'anonymous'
      expect(insertArgs[4]).toBeNull();       // comment defaults to null
    });
  });
});

describe('KnowledgeBaseService - Stats', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getStats', () => {
    it('returns aggregated knowledge base statistics', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 12, views: 340 }); // articleStats
      mockDb.get.mockResolvedValueOnce({ count: 4 });               // categoryCount
      mockDb.all.mockResolvedValueOnce([{ query: 'intro', count: 5 }]); // recentSearches
      mockDb.all.mockResolvedValueOnce([mockArticle]);              // topArticles

      const result = await knowledgeBaseService.getStats();

      expect(result.totalArticles).toBe(12);
      expect(result.totalCategories).toBe(4);
      expect(result.totalViews).toBe(340);
      expect(result.recentSearches).toHaveLength(1);
      expect(result.topArticles).toHaveLength(1);
    });

    it('handles null articleStats gracefully', async () => {
      mockDb.get.mockResolvedValueOnce(null); // no articles
      mockDb.get.mockResolvedValueOnce({ count: 0 });
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.all.mockResolvedValueOnce([]);

      const result = await knowledgeBaseService.getStats();

      expect(result.totalArticles).toBe(0);
      expect(result.totalViews).toBe(0);
    });
  });
});
