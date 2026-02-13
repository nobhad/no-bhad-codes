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
import { errorResponse, sendSuccess, sendCreated } from '../utils/api-response.js';

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
    sendSuccess(res, { categories });
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
      return errorResponse(res, 'Category not found', 404);
    }

    const articles = await knowledgeBaseService.getArticlesByCategory(req.params.slug);

    sendSuccess(res, { category, articles });
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
    sendSuccess(res, { articles });
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
      return errorResponse(res, 'Search query must be at least 2 characters', 400);
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const articles = await knowledgeBaseService.searchArticles(query, {
      limit,
      userId: req.user?.id,
      userType: req.user?.type
    });

    sendSuccess(res, { articles, query });
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
      return errorResponse(res, 'Article not found', 404);
    }

    // Increment view count
    await knowledgeBaseService.incrementViewCount(article.id);

    sendSuccess(res, { article });
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
      return errorResponse(res, 'Invalid article ID', 400);
    }

    if (typeof isHelpful !== 'boolean') {
      return errorResponse(res, 'isHelpful must be a boolean', 400);
    }

    await knowledgeBaseService.submitFeedback({
      articleId,
      isHelpful,
      userId: req.user?.id,
      userType: req.user?.type,
      comment
    });

    sendSuccess(res, undefined, 'Feedback submitted');
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
    sendSuccess(res, { categories });
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
      return errorResponse(res, 'name and slug are required', 400);
    }

    const category = await knowledgeBaseService.createCategory({
      name,
      slug,
      description,
      icon,
      color,
      sort_order
    });

    sendCreated(res, { category }, 'Category created');
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
      return errorResponse(res, 'Invalid category ID', 400);
    }

    const category = await knowledgeBaseService.updateCategory(id, req.body);

    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    sendSuccess(res, { category }, 'Category updated');
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
      return errorResponse(res, 'Invalid category ID', 400);
    }

    await knowledgeBaseService.deleteCategory(id);
    sendSuccess(res, undefined, 'Category deleted');
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

    sendSuccess(res, { articles });
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
      return errorResponse(res, 'Invalid article ID', 400);
    }

    const article = await knowledgeBaseService.getArticleById(id);

    if (!article) {
      return errorResponse(res, 'Article not found', 404);
    }

    sendSuccess(res, { article });
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
      return errorResponse(res, 'category_id, title, slug, and content are required', 400);
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

    sendCreated(res, { article }, 'Article created');
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
      return errorResponse(res, 'Invalid article ID', 400);
    }

    const article = await knowledgeBaseService.updateArticle(id, req.body);

    if (!article) {
      return errorResponse(res, 'Article not found', 404);
    }

    sendSuccess(res, { article }, 'Article updated');
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
      return errorResponse(res, 'Invalid article ID', 400);
    }

    await knowledgeBaseService.deleteArticle(id);
    sendSuccess(res, undefined, 'Article deleted');
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
    sendSuccess(res, stats);
  })
);

export { router as knowledgeBaseRouter };
export default router;
