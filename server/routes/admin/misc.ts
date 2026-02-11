import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { emailService } from '../../services/email-service.js';
import { softDeleteService, SoftDeleteEntityType } from '../../services/soft-delete-service.js';
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';

const router = express.Router();

/**
 * POST /api/admin/test-email - Send a test email to admin
 */
router.post(
  '/test-email',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const adminEmail = process.env.ADMIN_EMAIL || req.user?.email;
    if (!adminEmail) {
      return errorResponse(
        res,
        'Admin email not configured. Set ADMIN_EMAIL in environment.',
        400,
        'ADMIN_EMAIL_NOT_CONFIGURED'
      );
    }

    const result = await emailService.sendEmail({
      to: adminEmail,
      subject: 'No Bhad Codes - Test Email',
      text: 'This is a test email from the admin dashboard. Email service is working correctly.',
      html: '<p>This is a test email from the admin dashboard.</p><p>Email service is working correctly.</p>'
    });

    if (!result.success) {
      return errorResponse(res, result.message || 'Failed to send test email', 500, 'TEST_EMAIL_FAILED');
    }

    res.json({
      message: 'Test email sent successfully',
      to: adminEmail
    });
  })
);

// ============================================
// DELETED ITEMS MANAGEMENT (30-DAY RECOVERY)
// ============================================

/**
 * GET /api/admin/deleted-items - List all deleted items
 * Optional query param: ?type=client|project|invoice|lead|proposal
 */
router.get(
  '/deleted-items',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const entityType = req.query.type as SoftDeleteEntityType | undefined;

    // Validate type if provided
    if (entityType && !['client', 'project', 'invoice', 'lead', 'proposal'].includes(entityType)) {
      return errorResponse(res, 'Invalid entity type', 400, 'INVALID_TYPE');
    }

    const items = await softDeleteService.getDeletedItems(entityType);
    res.json({ success: true, items });
  })
);

/**
 * GET /api/admin/deleted-items/stats - Get counts of deleted items by type
 */
router.get(
  '/deleted-items/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const stats = await softDeleteService.getDeletedItemStats();
    res.json({ success: true, stats });
  })
);

/**
 * POST /api/admin/deleted-items/:type/:id/restore - Restore a deleted item
 */
router.post(
  '/deleted-items/:type/:id/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const entityType = req.params.type as SoftDeleteEntityType;
    const entityId = parseInt(req.params.id);

    // Validate type
    if (!['client', 'project', 'invoice', 'lead', 'proposal'].includes(entityType)) {
      return errorResponse(res, 'Invalid entity type', 400, 'INVALID_TYPE');
    }

    if (isNaN(entityId)) {
      return errorResponse(res, 'Invalid entity ID', 400, 'INVALID_ID');
    }

    const result = await softDeleteService.restore(entityType, entityId);

    if (!result.success) {
      return errorResponse(res, result.message, 404, 'RESOURCE_NOT_FOUND');
    }

    res.json({
      success: true,
      message: result.message
    });
  })
);

/**
 * DELETE /api/admin/deleted-items/:type/:id/permanent - Permanently delete an item
 * This bypasses the 30-day recovery period
 */
router.delete(
  '/deleted-items/:type/:id/permanent',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const entityType = req.params.type as SoftDeleteEntityType;
    const entityId = parseInt(req.params.id);

    // Validate type
    if (!['client', 'project', 'invoice', 'lead', 'proposal'].includes(entityType)) {
      return errorResponse(res, 'Invalid entity type', 400, 'INVALID_TYPE');
    }

    if (isNaN(entityId)) {
      return errorResponse(res, 'Invalid entity ID', 400, 'INVALID_ID');
    }

    const result = await softDeleteService.forceDelete(entityType, entityId);

    if (!result.success) {
      return errorResponse(res, result.message, 404, 'RESOURCE_NOT_FOUND');
    }

    res.json({
      success: true,
      message: result.message
    });
  })
);

/**
 * POST /api/admin/deleted-items/cleanup - Manually trigger cleanup of expired items
 * Items older than 30 days will be permanently deleted
 */
router.post(
  '/deleted-items/cleanup',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const { deleted, errors } = await softDeleteService.permanentlyDeleteExpired();

    res.json({
      success: errors.length === 0,
      message: `Cleanup complete. Permanently deleted ${deleted.total} items.`,
      deleted,
      errors: errors.length > 0 ? errors : undefined
    });
  })
);

// =====================================================
// DELETED ITEMS MANAGEMENT
// =====================================================

/**
 * GET /api/admin/deleted-items - List all soft-deleted items
 * Optional query param: type (client, project, invoice, lead, proposal)
 */
router.get(
  '/deleted-items',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const typeParam = req.query.type as string | undefined;
    const entityType = typeParam as SoftDeleteEntityType | undefined;

    // Validate entity type if provided
    const validTypes: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];
    if (entityType && !validTypes.includes(entityType)) {
      return errorResponseWithPayload(res, 'Invalid entity type', 400, 'INVALID_TYPE', { validTypes });
    }

    const [items, stats] = await Promise.all([
      softDeleteService.getDeletedItems(entityType),
      softDeleteService.getDeletedItemStats()
    ]);

    // Transform to match frontend expected format
    const transformedItems = items.map(item => ({
      id: item.id,
      type: item.entityType,
      name: item.name,
      deleted_at: item.deletedAt,
      deleted_by: item.deletedBy,
      days_until_permanent: item.daysUntilPermanent
    }));

    res.json({
      items: transformedItems,
      stats
    });
  })
);

/**
 * GET /api/admin/deleted-items/stats - Get counts by entity type
 */
router.get(
  '/deleted-items/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const stats = await softDeleteService.getDeletedItemStats();
    res.json(stats);
  })
);

/**
 * POST /api/admin/deleted-items/:type/:id/restore - Restore a soft-deleted item
 */
router.post(
  '/deleted-items/:type/:id/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { type, id } = req.params;
    const entityId = parseInt(id, 10);

    // Validate entity type
    const validTypes: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];
    if (!validTypes.includes(type as SoftDeleteEntityType)) {
      return errorResponseWithPayload(res, 'Invalid entity type', 400, 'INVALID_TYPE', { validTypes });
    }

    if (isNaN(entityId) || entityId <= 0) {
      return errorResponse(res, 'Invalid entity ID', 400, 'INVALID_ID');
    }

    const result = await softDeleteService.restore(type as SoftDeleteEntityType, entityId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      errorResponse(res, result.message, 400, 'RESTORE_FAILED');
    }
  })
);

/**
 * DELETE /api/admin/deleted-items/:type/:id/permanent - Permanently delete an item
 */
router.delete(
  '/deleted-items/:type/:id/permanent',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { type, id } = req.params;
    const entityId = parseInt(id, 10);

    // Validate entity type
    const validTypes: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];
    if (!validTypes.includes(type as SoftDeleteEntityType)) {
      return errorResponseWithPayload(res, 'Invalid entity type', 400, 'INVALID_TYPE', { validTypes });
    }

    if (isNaN(entityId) || entityId <= 0) {
      return errorResponse(res, 'Invalid entity ID', 400, 'INVALID_ID');
    }

    const result = await softDeleteService.forceDelete(type as SoftDeleteEntityType, entityId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      errorResponse(res, result.message, 400, 'DELETE_FAILED');
    }
  })
);

export default router;
