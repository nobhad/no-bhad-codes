/**
 * ===============================================
 * KNOWLEDGE BASE ROUTES
 * ===============================================
 * @file server/routes/knowledge-base.ts
 *
 * API endpoints for knowledge base articles and categories
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { knowledgeBaseService } from '../services/knowledge-base-service.js';

const router = express.Router();

// =====================================================
// PUBLIC ENDPOINTS (for clients)
// =====================================================

/**
 * Get all active categories with article counts
 */
router.get(
  '/categories',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const categories = await knowledgeBaseService.getCategories(false);
    res.json({ success: true, categories });
  })
);

/**
 * Get a category by slug
 */
router.get(
  '/categories/:slug',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const category = await knowledgeBaseService.getCategoryBySlug(req.params.slug);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const articles = await knowledgeBaseService.getArticlesByCategory(req.params.slug);

    res.json({ success: true, category, articles });
  })
);

/**
 * Get featured articles
 */
router.get(
  '/featured',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const articles = await knowledgeBaseService.getFeaturedArticles(limit);
    res.json({ success: true, articles });
  })
);

/**
 * Search articles
 */
router.get(
  '/search',
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const query = req.query.q as string;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const articles = await knowledgeBaseService.searchArticles(query, {
      limit,
      userId: req.user?.id,
      userType: req.user?.type
    });

    res.json({ success: true, articles, query });
  })
);

/**
 * Get an article by category and article slug
 */
router.get(
  '/articles/:categorySlug/:articleSlug',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { categorySlug, articleSlug } = req.params;
    const article = await knowledgeBaseService.getArticleBySlug(categorySlug, articleSlug);

    if (!article || !article.is_published) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Increment view count
    await knowledgeBaseService.incrementViewCount(article.id);

    res.json({ success: true, article });
  })
);

/**
 * Submit feedback for an article
 */
router.post(
  '/articles/:id/feedback',
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const articleId = parseInt(req.params.id);
    const { isHelpful, comment } = req.body;

    if (isNaN(articleId)) {
      return res.status(400).json({ error: 'Invalid article ID' });
    }

    if (typeof isHelpful !== 'boolean') {
      return res.status(400).json({ error: 'isHelpful must be a boolean' });
    }

    await knowledgeBaseService.submitFeedback({
      articleId,
      isHelpful,
      userId: req.user?.id,
      userType: req.user?.type,
      comment
    });

    res.json({ success: true, message: 'Feedback submitted' });
  })
);

// =====================================================
// ADMIN ENDPOINTS
// =====================================================

/**
 * Get all categories (including inactive) for admin
 */
router.get(
  '/admin/categories',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const categories = await knowledgeBaseService.getCategories(true);
    res.json({ success: true, categories });
  })
);

/**
 * Create a new category
 */
router.post(
  '/admin/categories',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, slug, description, icon, color, sort_order } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }

    const category = await knowledgeBaseService.createCategory({
      name,
      slug,
      description,
      icon,
      color,
      sort_order
    });

    res.status(201).json({
      success: true,
      message: 'Category created',
      category
    });
  })
);

/**
 * Update a category
 */
router.put(
  '/admin/categories/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    const category = await knowledgeBaseService.updateCategory(id, req.body);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      success: true,
      message: 'Category updated',
      category
    });
  })
);

/**
 * Delete a category
 */
router.delete(
  '/admin/categories/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    await knowledgeBaseService.deleteCategory(id);
    res.json({ success: true, message: 'Category deleted' });
  })
);

/**
 * Get all articles for admin (including unpublished)
 */
router.get(
  '/admin/articles',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const categorySlug = req.query.category as string | undefined;

    let articles;
    if (categorySlug) {
      articles = await knowledgeBaseService.getArticlesByCategory(categorySlug, false);
    } else {
      // Get all articles across all categories
      const categories = await knowledgeBaseService.getCategories(true);
      articles = [];
      for (const cat of categories) {
        const catArticles = await knowledgeBaseService.getArticlesByCategory(cat.slug, false);
        articles.push(...catArticles);
      }
    }

    res.json({ success: true, articles });
  })
);

/**
 * Get a single article for admin
 */
router.get(
  '/admin/articles/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid article ID' });
    }

    const article = await knowledgeBaseService.getArticleById(id);

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ success: true, article });
  })
);

/**
 * Create a new article
 */
router.post(
  '/admin/articles',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { category_id, title, slug, summary, content, keywords, is_featured, is_published } = req.body;

    if (!category_id || !title || !slug || !content) {
      return res.status(400).json({ error: 'category_id, title, slug, and content are required' });
    }

    const article = await knowledgeBaseService.createArticle({
      category_id,
      title,
      slug,
      summary,
      content,
      keywords,
      is_featured,
      is_published,
      author_email: req.user?.email
    });

    res.status(201).json({
      success: true,
      message: 'Article created',
      article
    });
  })
);

/**
 * Update an article
 */
router.put(
  '/admin/articles/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid article ID' });
    }

    const article = await knowledgeBaseService.updateArticle(id, req.body);

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({
      success: true,
      message: 'Article updated',
      article
    });
  })
);

/**
 * Delete an article
 */
router.delete(
  '/admin/articles/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid article ID' });
    }

    await knowledgeBaseService.deleteArticle(id);
    res.json({ success: true, message: 'Article deleted' });
  })
);

/**
 * Get knowledge base statistics
 */
router.get(
  '/admin/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const stats = await knowledgeBaseService.getStats();
    res.json({ success: true, ...stats });
  })
);

export { router as knowledgeBaseRouter };
export default router;
