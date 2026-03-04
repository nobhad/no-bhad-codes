/**
 * ===============================================
 * ADMIN DESIGN REVIEWS ROUTES
 * ===============================================
 * @file server/routes/admin/design-reviews.ts
 *
 * Endpoints for managing design review items.
 * Design reviews are deliverables that require client approval.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { getDatabase } from '../../database/init.js';
import { errorResponse, sendSuccess } from '../../utils/api-response.js';

// Explicit column lists for SELECT queries (avoid SELECT *)
const DELIVERABLE_COLUMNS = `
  id, project_id, type, title, description, status, approval_status, round_number,
  created_by_id, reviewed_by_id, review_deadline, approved_at, locked, tags,
  archived_file_id, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const router = express.Router();

/**
 * GET /api/admin/design-reviews - Get all design reviews
 * Design reviews are deliverables that are in review-related statuses
 */
router.get(
  '/design-reviews',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId } = req.query;
    const db = getDatabase();

    let whereClause = 'WHERE d.status IN (\'ready_for_review\', \'revision_requested\', \'approved\')';
    const params: (string | number)[] = [];

    if (projectId) {
      whereClause += ' AND d.project_id = ?';
      params.push(String(projectId));
    }

    const reviews = await db.all(`
      SELECT
        d.id,
        d.name as title,
        d.description,
        d.project_id as projectId,
        p.project_name as projectName,
        p.client_id as clientId,
        COALESCE(c.company_name, c.contact_name) as clientName,
        CASE
          WHEN d.status = 'ready_for_review' THEN 'pending'
          WHEN d.status = 'revision_requested' THEN 'revision-requested'
          WHEN d.status = 'approved' THEN 'approved'
          ELSE d.status
        END as status,
        COALESCE(d.revision_count, 1) as version,
        0 as comments,
        (SELECT COUNT(*) FROM files f WHERE f.entity_type = 'deliverable' AND f.entity_id = d.id) as attachments,
        d.created_at as createdAt,
        d.updated_at as updatedAt,
        d.due_date as dueDate
      FROM deliverables d
      JOIN projects p ON d.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      ${whereClause}
      ORDER BY d.updated_at DESC
    `, params);

    // Calculate stats
    const stats = {
      total: reviews.length,
      pending: reviews.filter((r: { status: string }) => r.status === 'pending').length,
      inReview: reviews.filter((r: { status: string }) => r.status === 'in-review').length,
      approved: reviews.filter((r: { status: string }) => r.status === 'approved').length,
      revisionRequested: reviews.filter((r: { status: string }) => r.status === 'revision-requested').length
    };

    sendSuccess(res, { reviews, stats });
  })
);

/**
 * GET /api/admin/design-reviews/:reviewId - Get a specific design review
 */
router.get(
  '/design-reviews/:reviewId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const reviewId = parseInt(req.params.reviewId);

    if (isNaN(reviewId)) {
      return errorResponse(res, 'Invalid review ID', 400, 'INVALID_ID');
    }

    const db = getDatabase();

    const review = await db.get(`
      SELECT
        d.id,
        d.name as title,
        d.description,
        d.project_id as projectId,
        p.project_name as projectName,
        p.client_id as clientId,
        COALESCE(c.company_name, c.contact_name) as clientName,
        d.status,
        COALESCE(d.revision_count, 1) as version,
        d.created_at as createdAt,
        d.updated_at as updatedAt,
        d.due_date as dueDate
      FROM deliverables d
      JOIN projects p ON d.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE d.id = ?
    `, [reviewId]);

    if (!review) {
      return errorResponse(res, 'Design review not found', 404, 'NOT_FOUND');
    }

    // Get attachments
    const attachments = await db.all(`
      SELECT id, filename, file_path as filePath, file_size as fileSize, created_at as createdAt
      FROM files
      WHERE entity_type = 'deliverable' AND entity_id = ?
    `, [reviewId]);

    sendSuccess(res, { review: { ...review, attachments } });
  })
);

/**
 * PATCH /api/admin/design-reviews/:reviewId - Update review status
 */
router.patch(
  '/design-reviews/:reviewId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const reviewId = parseInt(req.params.reviewId);
    const { status } = req.body;

    if (isNaN(reviewId)) {
      return errorResponse(res, 'Invalid review ID', 400, 'INVALID_ID');
    }

    // Map frontend status to database status
    const statusMap: Record<string, string> = {
      'pending': 'ready_for_review',
      'in-review': 'in_progress',
      'approved': 'approved',
      'revision-requested': 'revision_requested',
      'rejected': 'rejected'
    };

    const dbStatus = statusMap[status] || status;

    const db = getDatabase();

    await db.run(`
      UPDATE deliverables
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [dbStatus, reviewId]);

    const updated = await db.get(`SELECT ${DELIVERABLE_COLUMNS} FROM deliverables WHERE id = ?`, [reviewId]);

    sendSuccess(res, { review: updated });
  })
);

export default router;
