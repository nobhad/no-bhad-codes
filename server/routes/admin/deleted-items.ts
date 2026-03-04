/**
 * ===============================================
 * ADMIN DELETED ITEMS ROUTES
 * ===============================================
 * @file server/routes/admin/deleted-items.ts
 *
 * Soft-deleted items management (30-day recovery).
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { softDeleteService, SoftDeleteEntityType } from '../../services/soft-delete-service.js';
import { errorResponse, errorResponseWithPayload, sendSuccess } from '../../utils/api-response.js';

const VALID_ENTITY_TYPES: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];

const router = express.Router();

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

    if (entityType && !VALID_ENTITY_TYPES.includes(entityType)) {
      return errorResponseWithPayload(res, 'Invalid entity type', 400, 'INVALID_TYPE', {
        validTypes: VALID_ENTITY_TYPES
      });
    }

    const [items, stats] = await Promise.all([
      softDeleteService.getDeletedItems(entityType),
      softDeleteService.getDeletedItemStats()
    ]);

    const transformedItems = items.map((item) => {
      const expiresAt = new Date(Date.now() + item.daysUntilPermanent * 24 * 60 * 60 * 1000).toISOString();
      return {
        id: `${item.entityType}-${item.id}`,
        type: item.entityType,
        name: item.name,
        description: '',
        deletedBy: item.deletedBy || 'Unknown',
        deletedAt: item.deletedAt,
        expiresAt,
        originalId: String(item.id)
      };
    });

    sendSuccess(res, { items: transformedItems, stats });
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
    sendSuccess(res, stats);
  })
);

/**
 * DELETE /api/admin/deleted-items/empty - Empty trash (permanently delete all expired items)
 * IMPORTANT: This route must come BEFORE /:itemId routes
 */
router.delete(
  '/deleted-items/empty',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const { deleted, errors } = await softDeleteService.permanentlyDeleteExpired();

    sendSuccess(res, {
      allSucceeded: errors.length === 0,
      deleted,
      errors: errors.length > 0 ? errors : undefined
    }, `Trash emptied. Permanently deleted ${deleted.total} items.`);
  })
);

/**
 * POST /api/admin/deleted-items/cleanup - Manually trigger cleanup of expired items
 */
router.post(
  '/deleted-items/cleanup',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const { deleted, errors } = await softDeleteService.permanentlyDeleteExpired();

    sendSuccess(res, {
      allSucceeded: errors.length === 0,
      deleted,
      errors: errors.length > 0 ? errors : undefined
    }, `Cleanup complete. Permanently deleted ${deleted.total} items.`);
  })
);

/**
 * Helper to parse composite item IDs (format: "type-id")
 */
function parseCompositeId(itemId: string): { entityType: SoftDeleteEntityType; entityId: number } | null {
  const parts = itemId.split('-');
  if (parts.length < 2) return null;

  const entityType = parts[0] as SoftDeleteEntityType;
  const entityId = parseInt(parts.slice(1).join('-'), 10);

  if (!VALID_ENTITY_TYPES.includes(entityType)) return null;
  if (isNaN(entityId) || entityId <= 0) return null;

  return { entityType, entityId };
}

/**
 * POST /api/admin/deleted-items/bulk-restore - Bulk restore soft-deleted items
 */
router.post(
  '/deleted-items/bulk-restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return errorResponse(res, 'itemIds array is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    let restored = 0;
    const errors: string[] = [];

    for (const itemId of itemIds) {
      const parsed = parseCompositeId(itemId as string);
      if (!parsed) {
        errors.push(`Invalid item ID: ${itemId}`);
        continue;
      }

      const result = await softDeleteService.restore(parsed.entityType, parsed.entityId);
      if (result.success) {
        restored++;
      } else {
        errors.push(`Failed to restore ${itemId}: ${result.message}`);
      }
    }

    sendSuccess(res, {
      allSucceeded: errors.length === 0,
      restored,
      errors: errors.length > 0 ? errors : undefined
    });
  })
);

/**
 * POST /api/admin/deleted-items/bulk-delete - Bulk permanently delete items
 */
router.post(
  '/deleted-items/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return errorResponse(res, 'itemIds array is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    let deleted = 0;
    const errors: string[] = [];

    for (const itemId of itemIds) {
      const parsed = parseCompositeId(itemId as string);
      if (!parsed) {
        errors.push(`Invalid item ID: ${itemId}`);
        continue;
      }

      const result = await softDeleteService.forceDelete(parsed.entityType, parsed.entityId);
      if (result.success) {
        deleted++;
      } else {
        errors.push(`Failed to delete ${itemId}: ${result.message}`);
      }
    }

    sendSuccess(res, {
      allSucceeded: errors.length === 0,
      deleted,
      errors: errors.length > 0 ? errors : undefined
    });
  })
);

/**
 * POST /api/admin/deleted-items/:itemId/restore - Restore a soft-deleted item
 */
router.post(
  '/deleted-items/:itemId/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const parsed = parseCompositeId(req.params.itemId);

    if (!parsed) {
      return errorResponseWithPayload(res, 'Invalid item ID format or entity type', 400, 'INVALID_ID', {
        validTypes: VALID_ENTITY_TYPES
      });
    }

    const result = await softDeleteService.restore(parsed.entityType, parsed.entityId);

    if (result.success) {
      sendSuccess(res, undefined, result.message);
    } else {
      errorResponse(res, result.message, 400, 'RESTORE_FAILED');
    }
  })
);

/**
 * DELETE /api/admin/deleted-items/:itemId - Permanently delete an item
 */
router.delete(
  '/deleted-items/:itemId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const parsed = parseCompositeId(req.params.itemId);

    if (!parsed) {
      return errorResponseWithPayload(res, 'Invalid item ID format or entity type', 400, 'INVALID_ID', {
        validTypes: VALID_ENTITY_TYPES
      });
    }

    const result = await softDeleteService.forceDelete(parsed.entityType, parsed.entityId);

    if (result.success) {
      sendSuccess(res, undefined, result.message);
    } else {
      errorResponse(res, result.message, 400, 'DELETE_FAILED');
    }
  })
);

export default router;
