/**
 * ===============================================
 * EMBED ADMIN ROUTES
 * ===============================================
 * @file server/routes/embed/admin.ts
 *
 * Admin endpoints for managing widget configurations.
 *
 * GET    /                       — List all widget configs
 * POST   /                       — Create widget config
 * GET    /:id                    — Get single config with embed code
 * PUT    /:id                    — Update config
 * DELETE /:id                    — Deactivate widget
 * POST   /:id/regenerate-token   — Regenerate token
 * GET    /:id/embed-code         — Get embed code HTML
 */

import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { embedService } from '../../services/embed-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { getBaseUrl } from '../../config/environment.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * GET /api/embed
 * List all widget configurations.
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: JWTAuthRequest, res: Response) => {
    const configurations = await embedService.list();
    sendSuccess(res, { configurations });
  })
);

/**
 * POST /api/embed
 * Create a new widget configuration.
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const { widgetType, name, config, allowedDomains } = req.body;

    if (!widgetType || !name) {
      errorResponse(res, 'widgetType and name are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const validTypes = ['contact_form', 'testimonials', 'status_badge'];
    if (!validTypes.includes(widgetType)) {
      errorResponse(res, `widgetType must be one of: ${validTypes.join(', ')}`, 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const configuration = await embedService.create({
      widgetType,
      name,
      config,
      allowedDomains
    });

    sendCreated(res, { configuration }, 'Widget created');
  })
);

/**
 * GET /api/embed/:id
 * Get a single widget configuration with embed code.
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const configuration = await embedService.getById(Number(req.params.id));

    if (!configuration) {
      errorResponse(res, 'Widget not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    const embedCode = embedService.generateEmbedCode(configuration, getBaseUrl());
    sendSuccess(res, { configuration, embedCode });
  })
);

/**
 * PUT /api/embed/:id
 * Update a widget configuration.
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    await embedService.update(Number(req.params.id), req.body);
    const configuration = await embedService.getById(Number(req.params.id));
    sendSuccess(res, { configuration }, 'Widget updated');
  })
);

/**
 * DELETE /api/embed/:id
 * Deactivate a widget configuration.
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    await embedService.deactivate(Number(req.params.id));
    sendSuccess(res, undefined, 'Widget deactivated');
  })
);

/**
 * POST /api/embed/:id/regenerate-token
 * Regenerate the public token for a widget.
 */
router.post(
  '/:id/regenerate-token',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const newToken = await embedService.regenerateToken(Number(req.params.id));
    sendSuccess(res, { token: newToken }, 'Token regenerated');
  })
);

/**
 * GET /api/embed/:id/embed-code
 * Get the embed code HTML for a widget.
 */
router.get(
  '/:id/embed-code',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const configuration = await embedService.getById(Number(req.params.id));

    if (!configuration) {
      errorResponse(res, 'Widget not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    const embedCode = embedService.generateEmbedCode(configuration, getBaseUrl());
    sendSuccess(res, { embedCode });
  })
);

export default router;
