/**
 * ===============================================
 * CLIENT FIELDS ROUTES
 * ===============================================
 * @file server/routes/clients/fields.ts
 *
 * Custom field definitions & values, tag assignments
 * per client, and CRM-specific field updates.
 */

import {
  express,
  authenticateToken,
  requireAdmin,
  type AuthenticatedRequest,
  asyncHandler,
  errorResponse,
  sendSuccess,
  sendCreated,
  ErrorCodes,
  invalidateCache,
  clientService
} from './helpers.js';

const router = express.Router();

// =====================================================
// CUSTOM FIELDS
// =====================================================

/**
 * @swagger
 * /api/clients/custom-fields:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/custom-fields - Get all custom field definitions
 *     description: GET /clients/custom-fields - Get all custom field definitions.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/custom-fields',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const fields = await clientService.getCustomFields(includeInactive);
    sendSuccess(res, { fields });
  })
);

/**
 * @swagger
 * /api/clients/custom-fields:
 *   post:
 *     tags: [Clients]
 *     summary: POST /clients/custom-fields - Create a custom field definition
 *     description: POST /clients/custom-fields - Create a custom field definition.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/custom-fields',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const {
      fieldName,
      fieldLabel,
      fieldType,
      options,
      isRequired,
      placeholder,
      defaultValue,
      displayOrder
    } = req.body;

    if (!fieldName || !fieldLabel || !fieldType) {
      return errorResponse(
        res,
        'Field name, label, and type are required',
        400,
        ErrorCodes.MISSING_REQUIRED_FIELDS
      );
    }

    const field = await clientService.createCustomField({
      fieldName,
      fieldLabel,
      fieldType,
      options,
      isRequired,
      placeholder,
      defaultValue,
      displayOrder
    });

    sendCreated(res, { field });
  })
);

/**
 * @swagger
 * /api/clients/custom-fields/{fieldId}:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /clients/custom-fields/:fieldId - Update a custom field definition
 *     description: PUT /clients/custom-fields/:fieldId - Update a custom field definition.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fieldId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/custom-fields/:fieldId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fieldId = parseInt(req.params.fieldId, 10);

    if (isNaN(fieldId) || fieldId <= 0) {
      return errorResponse(res, 'Invalid field ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const field = await clientService.updateCustomField(fieldId, req.body);
    sendSuccess(res, { field });
  })
);

/**
 * @swagger
 * /api/clients/custom-fields/{fieldId}:
 *   delete:
 *     tags: [Clients]
 *     summary: DELETE /clients/custom-fields/:fieldId - Delete a custom field (marks as inactive)
 *     description: DELETE /clients/custom-fields/:fieldId - Delete a custom field (marks as inactive).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fieldId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/custom-fields/:fieldId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fieldId = parseInt(req.params.fieldId, 10);

    if (isNaN(fieldId) || fieldId <= 0) {
      return errorResponse(res, 'Invalid field ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await clientService.deleteCustomField(fieldId);
    sendSuccess(res, undefined, 'Custom field deactivated');
  })
);

/**
 * @swagger
 * /api/clients/{id}/custom-fields:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/:id/custom-fields - Get custom field values for a client
 *     description: GET /clients/:id/custom-fields - Get custom field values for a client.
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
 *         description: Success
 */
router.get(
  '/:id/custom-fields',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const values = await clientService.getClientCustomFields(clientId);
    sendSuccess(res, { values });
  })
);

/**
 * @swagger
 * /api/clients/{id}/custom-fields:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /clients/:id/custom-fields - Set custom field values for a client
 *     description: PUT /clients/:id/custom-fields - Set custom field values for a client.
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
 *         description: Success
 */
router.put(
  '/:id/custom-fields',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { values } = req.body;

    if (!Array.isArray(values)) {
      return errorResponse(
        res,
        'Values must be an array of { fieldId, value } objects',
        400,
        'INVALID_FORMAT'
      );
    }

    await clientService.setClientCustomFields(clientId, values);
    sendSuccess(res, undefined, 'Custom field values updated');
  })
);

// =====================================================
// CLIENT TAG ASSIGNMENTS (/:id/tags routes)
// =====================================================

/**
 * @swagger
 * /api/clients/{id}/tags:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/:id/tags - Get tags for a client
 *     description: GET /clients/:id/tags - Get tags for a client.
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
 *         description: Success
 */
router.get(
  '/:id/tags',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const tags = await clientService.getClientTags(clientId);
    sendSuccess(res, { tags });
  })
);

/**
 * @swagger
 * /api/clients/{id}/tags/{tagId}:
 *   post:
 *     tags: [Clients]
 *     summary: POST /clients/:id/tags/:tagId - Add a tag to a client
 *     description: POST /clients/:id/tags/:tagId - Add a tag to a client.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/:id/tags/:tagId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);
    const tagId = parseInt(req.params.tagId, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (isNaN(tagId) || tagId <= 0) {
      return errorResponse(res, 'Invalid tag ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await clientService.addTagToClient(clientId, tagId);
    sendSuccess(res, undefined, 'Tag added to client');
  })
);

/**
 * @swagger
 * /api/clients/{id}/tags/{tagId}:
 *   delete:
 *     tags: [Clients]
 *     summary: DELETE /clients/:id/tags/:tagId - Remove a tag from a client
 *     description: DELETE /clients/:id/tags/:tagId - Remove a tag from a client.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/:id/tags/:tagId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);
    const tagId = parseInt(req.params.tagId, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (isNaN(tagId) || tagId <= 0) {
      return errorResponse(res, 'Invalid tag ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await clientService.removeTagFromClient(clientId, tagId);
    sendSuccess(res, undefined, 'Tag removed from client');
  })
);

// =====================================================
// CRM FIELDS
// =====================================================

/**
 * @swagger
 * /api/clients/{id}/crm:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /clients/:id/crm - Update CRM-specific fields for a client
 *     description: PUT /clients/:id/crm - Update CRM-specific fields for a client.
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
 *         description: Success
 */
router.put(
  '/:id/crm',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await clientService.updateCRMFields(clientId, req.body);
    sendSuccess(res, undefined, 'CRM fields updated');
  })
);

/**
 * @swagger
 * /api/clients/follow-up:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/follow-up - Get clients due for follow-up
 *     description: GET /clients/follow-up - Get clients due for follow-up.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/follow-up',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clients = await clientService.getClientsForFollowUp();
    sendSuccess(res, { clients });
  })
);

export { router as fieldsRouter };
export default router;
