/**
 * ===============================================
 * CONTENT REQUEST ROUTES - CLIENT
 * ===============================================
 * @file server/routes/content-requests/client.ts
 *
 * Client-facing endpoints for viewing and submitting content.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { contentRequestService } from '../../services/content-request-service.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';
import { invalidateCache } from '../../middleware/cache.js';
import { ContentRequestValidationSchemas } from './shared.js';

const router = express.Router();

/**
 * Resolve the item and confirm it belongs to the authenticated
 * client, returning null + writing the 404 when it doesn't. Every
 * submit endpoint runs this first — without it, an authenticated
 * client could submit text/files/URLs/data for any other client's
 * item by guessing the id.
 */
async function requireOwnItem(
  req: AuthenticatedRequest,
  res: express.Response,
  itemId: number
) {
  if (!Number.isInteger(itemId) || itemId <= 0) {
    errorResponse(res, 'Invalid item ID', 400, ErrorCodes.VALIDATION_ERROR);
    return null;
  }
  const item = await contentRequestService.getItem(itemId);
  if (!item || item.clientId !== req.user?.id) {
    // 404 not 403 — don't leak existence of other clients' items.
    errorResponse(res, 'Item not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    return null;
  }
  return item;
}

// =====================================================
// CLIENT ENDPOINTS
// =====================================================

/**
 * GET /api/content-requests/my
 * Get all checklists for the authenticated client
 */
router.get(
  '/my',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    if (!clientId) {
      errorResponse(res, 'Client authentication required', 401, ErrorCodes.UNAUTHORIZED);
      return;
    }

    const checklists = await contentRequestService.getByClient(clientId);
    sendSuccess(res, { checklists });
  })
);

/**
 * GET /api/content-requests/my/:id
 * Get a specific checklist with items
 */
router.get(
  '/my/:id',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    if (!clientId) {
      errorResponse(res, 'Client authentication required', 401, ErrorCodes.UNAUTHORIZED);
      return;
    }

    const checklist = await contentRequestService.getChecklist(Number(req.params.id));
    if (!checklist || checklist.clientId !== clientId) {
      errorResponse(res, 'Checklist not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    sendSuccess(res, { checklist });
  })
);

// =====================================================
// SUBMISSIONS
// =====================================================

/**
 * POST /api/content-requests/items/:itemId/submit-text
 * Submit text content for an item
 */
router.post(
  '/items/:itemId/submit-text',
  authenticateToken,
  validateRequest(ContentRequestValidationSchemas.submitText),
  invalidateCache(['content-requests']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const itemId = Number(req.params.itemId);
    if (!(await requireOwnItem(req, res, itemId))) return;

    const item = await contentRequestService.submitText(itemId, req.body.text);

    await workflowTriggerService.emit('content_request.submitted', {
      entityId: item.id,
      triggeredBy: req.user?.email,
      checklistId: item.checklistId,
      contentType: 'text'
    });

    sendSuccess(res, { item }, 'Text submitted');
  })
);

/**
 * POST /api/content-requests/items/:itemId/submit-file
 * Submit a file for an item (file must be uploaded first)
 */
router.post(
  '/items/:itemId/submit-file',
  authenticateToken,
  invalidateCache(['content-requests']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { file_id } = req.body;
    if (!file_id) {
      errorResponse(res, 'file_id is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const itemId = Number(req.params.itemId);
    if (!(await requireOwnItem(req, res, itemId))) return;

    const item = await contentRequestService.submitFile(itemId, file_id);

    await workflowTriggerService.emit('content_request.submitted', {
      entityId: item.id,
      triggeredBy: req.user?.email,
      checklistId: item.checklistId,
      contentType: 'file'
    });

    sendSuccess(res, { item }, 'File submitted');
  })
);

/**
 * POST /api/content-requests/items/:itemId/submit-url
 * Submit a URL for an item
 */
router.post(
  '/items/:itemId/submit-url',
  authenticateToken,
  validateRequest(ContentRequestValidationSchemas.submitUrl),
  invalidateCache(['content-requests']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const itemId = Number(req.params.itemId);
    if (!(await requireOwnItem(req, res, itemId))) return;

    const item = await contentRequestService.submitUrl(itemId, req.body.url);

    await workflowTriggerService.emit('content_request.submitted', {
      entityId: item.id,
      triggeredBy: req.user?.email,
      checklistId: item.checklistId,
      contentType: 'url'
    });

    sendSuccess(res, { item }, 'URL submitted');
  })
);

/**
 * POST /api/content-requests/items/:itemId/submit-data
 * Submit structured data for an item
 */
router.post(
  '/items/:itemId/submit-data',
  authenticateToken,
  invalidateCache(['content-requests']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      errorResponse(res, 'data object is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const itemId = Number(req.params.itemId);
    if (!(await requireOwnItem(req, res, itemId))) return;

    const item = await contentRequestService.submitStructured(itemId, data);

    await workflowTriggerService.emit('content_request.submitted', {
      entityId: item.id,
      triggeredBy: req.user?.email,
      checklistId: item.checklistId,
      contentType: 'structured'
    });

    sendSuccess(res, { item }, 'Data submitted');
  })
);

export default router;
