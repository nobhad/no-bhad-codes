/**
 * ===============================================
 * KNOWLEDGE BASE SERVICE
 * ===============================================
 * @file server/services/knowledge-base-service.ts
 *
 * Service for managing knowledge base articles and categories.
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// TYPES
// =====================================================

export interface KBCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  article_count?: number;
  created_at: string;
  updated_at: string;
}

export interface KBArticle {
  id: number;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  title: string;
  slug: string;
  summary?: string;
  content: string;
  keywords?: string;
  is_featured: boolean;
  is_published: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  sort_order: number;
  author_email?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

// =====================================================
// SERVICE CLASS
// =====================================================

class KnowledgeBaseService {
  // =====================================================
  // CATEGORIES
  // =====================================================

  /**
   * Get all active categories with article counts
   */
  async getCategories(includeInactive: boolean = false): Promise<KBCategory[]> {
    const db = await getDatabase();

    const whereClause = includeInactive ? '' : 'WHERE c.is_active = 1';

    const categories = await db.all(
      `SELECT c.*,
              COUNT(a.id) as article_count
       FROM kb_categories c
       LEFT JOIN kb_articles a ON c.id = a.category_id AND a.is_published = 1
       ${whereClause}
       GROUP BY c.id
       ORDER BY c.sort_order, c.name`
    );

    return categories as unknown as KBCategory[];
  }

  /**
   * Get a category by slug
   */
  async getCategoryBySlug(slug: string): Promise<KBCategory | null> {
    const db = await getDatabase();

    const category = await db.get(
      `SELECT c.*,
              COUNT(a.id) as article_count
       FROM kb_categories c
       LEFT JOIN kb_articles a ON c.id = a.category_id AND a.is_published = 1
       WHERE c.slug = ?
       GROUP BY c.id`,
      [slug]
    );

    return category as unknown as KBCategory | null;
  }

  /**
   * Create a new category
   */
  async createCategory(data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    color?: string;
    sort_order?: number;
  }): Promise<KBCategory> {
    const db = await getDatabase();

    const result = await db.run(
      `INSERT INTO kb_categories (name, slug, description, icon, color, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.slug,
        data.description || null,
        data.icon || 'book',
        data.color || '#6b7280',
        data.sort_order || 0
      ]
    );

    return this.getCategoryById(result.lastID!) as Promise<KBCategory>;
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: number): Promise<KBCategory | null> {
    const db = await getDatabase();
    const category = await db.get('SELECT * FROM kb_categories WHERE id = ?', [id]);
    return category as unknown as KBCategory | null;
  }

  /**
   * Update a category
   */
  async updateCategory(id: number, data: Partial<KBCategory>): Promise<KBCategory | null> {
    const db = await getDatabase();
    const category = await this.getCategoryById(id);

    if (!category) {
      return null;
    }

    await db.run(
      `UPDATE kb_categories
       SET name = ?, slug = ?, description = ?, icon = ?, color = ?,
           sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.name || category.name,
        data.slug || category.slug,
        data.description !== undefined ? data.description : category.description,
        data.icon || category.icon,
        data.color || category.color,
        data.sort_order !== undefined ? data.sort_order : category.sort_order,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : (category.is_active ? 1 : 0),
        id
      ]
    );

    return this.getCategoryById(id);
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: number): Promise<void> {
    const db = await getDatabase();
    await db.run('DELETE FROM kb_categories WHERE id = ?', [id]);
  }

  // =====================================================
  // ARTICLES
  // =====================================================

  /**
   * Get articles for a category
   */
  async getArticlesByCategory(
    categorySlug: string,
    publishedOnly: boolean = true
  ): Promise<KBArticle[]> {
    const db = await getDatabase();

    const publishedClause = publishedOnly ? 'AND a.is_published = 1' : '';

    const articles = await db.all(
      `SELECT a.*, c.name as category_name, c.slug as category_slug
       FROM kb_articles a
       JOIN kb_categories c ON a.category_id = c.id
       WHERE c.slug = ? ${publishedClause}
       ORDER BY a.sort_order, a.title`,
      [categorySlug]
    );

    return articles as unknown as KBArticle[];
  }

  /**
   * Get featured articles
   */
  async getFeaturedArticles(limit: number = 5): Promise<KBArticle[]> {
    const db = await getDatabase();

    const articles = await db.all(
      `SELECT a.*, c.name as category_name, c.slug as category_slug
       FROM kb_articles a
       JOIN kb_categories c ON a.category_id = c.id
       WHERE a.is_featured = 1 AND a.is_published = 1
       ORDER BY a.view_count DESC
       LIMIT ?`,
      [limit]
    );

    return articles as unknown as KBArticle[];
  }

  /**
   * Get an article by slug
   */
  async getArticleBySlug(categorySlug: string, articleSlug: string): Promise<KBArticle | null> {
    const db = await getDatabase();

    const article = await db.get(
      `SELECT a.*, c.name as category_name, c.slug as category_slug
       FROM kb_articles a
       JOIN kb_categories c ON a.category_id = c.id
       WHERE c.slug = ? AND a.slug = ?`,
      [categorySlug, articleSlug]
    );

    return article as unknown as KBArticle | null;
  }

  /**
   * Get article by ID
   */
  async getArticleById(id: number): Promise<KBArticle | null> {
    const db = await getDatabase();

    const article = await db.get(
      `SELECT a.*, c.name as category_name, c.slug as category_slug
       FROM kb_articles a
       JOIN kb_categories c ON a.category_id = c.id
       WHERE a.id = ?`,
      [id]
    );

    return article as unknown as KBArticle | null;
  }

  /**
   * Create a new article
   */
  async createArticle(data: {
    category_id: number;
    title: string;
    slug: string;
    summary?: string;
    content: string;
    keywords?: string;
    is_featured?: boolean;
    is_published?: boolean;
    author_email?: string;
  }): Promise<KBArticle> {
    const db = await getDatabase();

    const isPublished = data.is_published !== false;

    const result = await db.run(
      `INSERT INTO kb_articles
       (category_id, title, slug, summary, content, keywords, is_featured, is_published, author_email, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.category_id,
        data.title,
        data.slug,
        data.summary || null,
        data.content,
        data.keywords || null,
        data.is_featured ? 1 : 0,
        isPublished ? 1 : 0,
        data.author_email || null,
        isPublished ? new Date().toISOString() : null
      ]
    );

    return this.getArticleById(result.lastID!) as Promise<KBArticle>;
  }

  /**
   * Update an article
   */
  async updateArticle(id: number, data: Partial<KBArticle>): Promise<KBArticle | null> {
    const db = await getDatabase();
    const article = await this.getArticleById(id);

    if (!article) {
      return null;
    }

    // If publishing for the first time, set published_at
    const wasPublished = article.is_published;
    const willPublish = data.is_published !== undefined ? data.is_published : wasPublished;
    const publishedAt = !wasPublished && willPublish ? new Date().toISOString() : article.published_at;

    await db.run(
      `UPDATE kb_articles
       SET category_id = ?, title = ?, slug = ?, summary = ?, content = ?,
           keywords = ?, is_featured = ?, is_published = ?, sort_order = ?,
           published_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.category_id || article.category_id,
        data.title || article.title,
        data.slug || article.slug,
        data.summary !== undefined ? data.summary : article.summary,
        data.content || article.content,
        data.keywords !== undefined ? data.keywords : article.keywords,
        data.is_featured !== undefined ? (data.is_featured ? 1 : 0) : (article.is_featured ? 1 : 0),
        willPublish ? 1 : 0,
        data.sort_order !== undefined ? data.sort_order : article.sort_order,
        publishedAt,
        id
      ]
    );

    return this.getArticleById(id);
  }

  /**
   * Delete an article
   */
  async deleteArticle(id: number): Promise<void> {
    const db = await getDatabase();
    await db.run('DELETE FROM kb_articles WHERE id = ?', [id]);
  }

  /**
   * Increment view count
   */
  async incrementViewCount(id: number): Promise<void> {
    const db = await getDatabase();
    await db.run(
      'UPDATE kb_articles SET view_count = view_count + 1 WHERE id = ?',
      [id]
    );
  }

  // =====================================================
  // SEARCH
  // =====================================================

  /**
   * Search articles
   */
  async searchArticles(
    query: string,
    options: { limit?: number; userId?: number; userType?: string } = {}
  ): Promise<KBArticle[]> {
    const { limit = 20, userId, userType } = options;
    const db = await getDatabase();

    // Simple search using LIKE (for full-text search, use FTS5)
    const searchPattern = `%${query}%`;

    const articles = await db.all(
      `SELECT a.*, c.name as category_name, c.slug as category_slug
       FROM kb_articles a
       JOIN kb_categories c ON a.category_id = c.id
       WHERE a.is_published = 1
         AND (a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ? OR a.keywords LIKE ?)
       ORDER BY
         CASE WHEN a.title LIKE ? THEN 0 ELSE 1 END,
         a.view_count DESC
       LIMIT ?`,
      [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, limit]
    );

    // Log the search
    await this.logSearch(query, articles.length, userId, userType);

    return articles as unknown as KBArticle[];
  }

  /**
   * Log a search query
   */
  async logSearch(
    query: string,
    resultCount: number,
    userId?: number,
    userType?: string
  ): Promise<void> {
    const db = await getDatabase();

    await db.run(
      `INSERT INTO kb_search_log (query, result_count, user_id, user_type)
       VALUES (?, ?, ?, ?)`,
      [query, resultCount, userId || null, userType || 'anonymous']
    );
  }

  /**
   * Record article click from search
   */
  async recordSearchClick(articleId: number): Promise<void> {
    const db = await getDatabase();

    // Update the most recent search log for this article
    await db.run(
      `UPDATE kb_search_log
       SET clicked_article_id = ?
       WHERE id = (SELECT MAX(id) FROM kb_search_log WHERE clicked_article_id IS NULL)`,
      [articleId]
    );
  }

  // =====================================================
  // FEEDBACK
  // =====================================================

  /**
   * Submit feedback for an article
   */
  async submitFeedback(data: {
    articleId: number;
    isHelpful: boolean;
    userId?: number;
    userType?: string;
    comment?: string;
  }): Promise<void> {
    const db = await getDatabase();

    // Insert feedback
    await db.run(
      `INSERT INTO kb_article_feedback (article_id, user_id, user_type, is_helpful, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.articleId,
        data.userId || null,
        data.userType || 'anonymous',
        data.isHelpful ? 1 : 0,
        data.comment || null
      ]
    );

    // Update article counts
    const countField = data.isHelpful ? 'helpful_count' : 'not_helpful_count';
    await db.run(
      `UPDATE kb_articles SET ${countField} = ${countField} + 1 WHERE id = ?`,
      [data.articleId]
    );
  }

  // =====================================================
  // STATS
  // =====================================================

  /**
   * Get knowledge base statistics
   */
  async getStats(): Promise<{
    totalArticles: number;
    totalCategories: number;
    totalViews: number;
    recentSearches: { query: string; count: number }[];
    topArticles: KBArticle[];
  }> {
    const db = await getDatabase();

    const articleStats = await db.get(
      'SELECT COUNT(*) as count, SUM(view_count) as views FROM kb_articles WHERE is_published = 1'
    ) as { count: number; views: number };

    const categoryCount = await db.get(
      'SELECT COUNT(*) as count FROM kb_categories WHERE is_active = 1'
    ) as { count: number };

    const recentSearches = await db.all(
      `SELECT query, COUNT(*) as count
       FROM kb_search_log
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY query
       ORDER BY count DESC
       LIMIT 10`
    );

    const topArticles = await db.all(
      `SELECT a.*, c.name as category_name
       FROM kb_articles a
       JOIN kb_categories c ON a.category_id = c.id
       WHERE a.is_published = 1
       ORDER BY a.view_count DESC
       LIMIT 5`
    );

    return {
      totalArticles: articleStats?.count || 0,
      totalCategories: categoryCount?.count || 0,
      totalViews: articleStats?.views || 0,
      recentSearches: recentSearches as { query: string; count: number }[],
      topArticles: topArticles as unknown as KBArticle[]
    };
  }
}

// Export singleton instance
export const knowledgeBaseService = new KnowledgeBaseService();
