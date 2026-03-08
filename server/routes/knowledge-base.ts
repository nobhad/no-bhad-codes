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
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../utils/api-response.js';

const router = express.Router();

// =====================================================
// PUBLIC ENDPOINTS (for clients)
// =====================================================

/**
 * @swagger
 * /api/kb/categories:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Get all active categories
 *     description: Returns all active knowledge base categories with article counts.
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get(
  '/categories',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const categories = await knowledgeBaseService.getCategories(false);
    sendSuccess(res, { categories });
  })
);

/**
 * @swagger
 * /api/kb/categories/{slug}:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Get a category by slug
 *     description: Returns a specific category and its articles by URL slug.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Category URL slug
 *     responses:
 *       200:
 *         description: Category with articles
 *       404:
 *         description: Category not found
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
 * @swagger
 * /api/kb/featured:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Get featured articles
 *     description: Returns featured knowledge base articles.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Maximum number of articles to return
 *     responses:
 *       200:
 *         description: List of featured articles
 */
router.get(
  '/featured',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const articles = await knowledgeBaseService.getFeaturedArticles(limit);
    sendSuccess(res, { articles });
  })
);

/**
 * @swagger
 * /api/kb/search:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Search articles
 *     description: Searches knowledge base articles by query string.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum results
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Query too short
 */
router.get(
  '/search',
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const queryParam = req.query.q as string;

    if (!queryParam || queryParam.length < 2) {
      return errorResponse(res, 'Search query must be at least 2 characters', 400);
    }

    // Truncate search query to prevent DoS
    const query = queryParam.substring(0, 200);
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const limit = isNaN(limitParam) || limitParam < 1 || limitParam > 100 ? 20 : limitParam;
    const articles = await knowledgeBaseService.searchArticles(query, {
      limit,
      userId: req.user?.id,
      userType: req.user?.type
    });

    sendSuccess(res, { articles, query });
  })
);

/**
 * @swagger
 * /api/kb/articles/{categorySlug}/{articleSlug}:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Get an article by slugs
 *     description: Returns a specific article by its category and article URL slugs.
 *     parameters:
 *       - in: path
 *         name: categorySlug
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: articleSlug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Article details
 *       404:
 *         description: Article not found
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
 * @swagger
 * /api/kb/articles/{id}/feedback:
 *   post:
 *     tags: [Knowledge Base]
 *     summary: Submit article feedback
 *     description: Submits helpful/not helpful feedback for a knowledge base article.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isHelpful]
 *             properties:
 *               isHelpful:
 *                 type: boolean
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Feedback submitted
 *       400:
 *         description: Validation error
 */
router.post(
  '/articles/:id/feedback',
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const articleId = parseInt(req.params.id, 10);
    const { isHelpful, comment } = req.body;

    if (isNaN(articleId) || articleId <= 0) {
      return errorResponse(res, 'Invalid article ID', 400, ErrorCodes.VALIDATION_ERROR);
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
 * @swagger
 * /api/kb/admin/categories:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Get all categories (admin)
 *     description: Returns all categories including inactive ones for admin management.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of all categories
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
 * @swagger
 * /api/kb/admin/categories:
 *   post:
 *     tags: [Knowledge Base]
 *     summary: Create a new category
 *     description: Creates a new knowledge base category.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug]
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *               color:
 *                 type: string
 *               sort_order:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Category created
 *       400:
 *         description: Validation error
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
 * @swagger
 * /api/kb/admin/categories/{id}:
 *   put:
 *     tags: [Knowledge Base]
 *     summary: Update a category
 *     description: Updates an existing knowledge base category.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category updated
 *       404:
 *         description: Category not found
 */
router.put(
  '/admin/categories/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid category ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const category = await knowledgeBaseService.updateCategory(id, req.body);

    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    sendSuccess(res, { category }, 'Category updated');
  })
);

/**
 * @swagger
 * /api/kb/admin/categories/{id}:
 *   delete:
 *     tags: [Knowledge Base]
 *     summary: Delete a category
 *     description: Deletes a knowledge base category.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category deleted
 *       400:
 *         description: Invalid category ID
 */
router.delete(
  '/admin/categories/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid category ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await knowledgeBaseService.deleteCategory(id);
    sendSuccess(res, undefined, 'Category deleted');
  })
);

/**
 * @swagger
 * /api/kb/admin/articles:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Get all articles (admin)
 *     description: Returns all articles including unpublished ones for admin management.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category slug
 *     responses:
 *       200:
 *         description: List of all articles
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
 * @swagger
 * /api/kb/admin/articles/{id}:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Get a single article (admin)
 *     description: Returns a specific article by ID for admin editing.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Article details
 *       404:
 *         description: Article not found
 */
router.get(
  '/admin/articles/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid article ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const article = await knowledgeBaseService.getArticleById(id);

    if (!article) {
      return errorResponse(res, 'Article not found', 404);
    }

    sendSuccess(res, { article });
  })
);

/**
 * @swagger
 * /api/kb/admin/articles:
 *   post:
 *     tags: [Knowledge Base]
 *     summary: Create a new article
 *     description: Creates a new knowledge base article.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category_id, title, slug, content]
 *             properties:
 *               category_id:
 *                 type: integer
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               summary:
 *                 type: string
 *               content:
 *                 type: string
 *               keywords:
 *                 type: string
 *               is_featured:
 *                 type: boolean
 *               is_published:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Article created
 *       400:
 *         description: Validation error
 */
router.post(
  '/admin/articles',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { category_id, title, slug, summary, content, keywords, is_featured, is_published } =
      req.body;

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
 * @swagger
 * /api/kb/admin/articles/{id}:
 *   put:
 *     tags: [Knowledge Base]
 *     summary: Update an article
 *     description: Updates an existing knowledge base article.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Article updated
 *       404:
 *         description: Article not found
 */
router.put(
  '/admin/articles/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid article ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const article = await knowledgeBaseService.updateArticle(id, req.body);

    if (!article) {
      return errorResponse(res, 'Article not found', 404);
    }

    sendSuccess(res, { article }, 'Article updated');
  })
);

/**
 * @swagger
 * /api/kb/admin/articles/{id}:
 *   delete:
 *     tags: [Knowledge Base]
 *     summary: Delete an article
 *     description: Deletes a knowledge base article.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Article deleted
 *       400:
 *         description: Invalid article ID
 */
router.delete(
  '/admin/articles/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid article ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await knowledgeBaseService.deleteArticle(id);
    sendSuccess(res, undefined, 'Article deleted');
  })
);

/**
 * @swagger
 * /api/kb/admin/stats:
 *   get:
 *     tags: [Knowledge Base]
 *     summary: Get knowledge base statistics
 *     description: Returns statistics about the knowledge base including article and category counts.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Knowledge base statistics
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
