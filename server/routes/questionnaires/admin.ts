/**
 * ===============================================
 * QUESTIONNAIRE ROUTES — ADMIN
 * ===============================================
 * @file server/routes/questionnaires/admin.ts
 *
 * Admin CRUD + response management endpoints
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { questionnaireService, ResponseStatus } from '../../services/questionnaire-service.js';
import {
  errorResponse,
  errorResponseWithPayload,
  sendSuccess,
  sendCreated,
  ErrorCodes
} from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';
import { QuestionnaireValidationSchemas } from './shared.js';

const router = express.Router();

// =====================================================
// ADMIN ENDPOINTS - QUESTIONNAIRE CRUD
// =====================================================

/**
 * @swagger
 * /api/questionnaires:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Get all questionnaires (admin)
 *     description: Returns all questionnaires with optional filtering.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: project_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of questionnaires
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectType = req.query.project_type as string | undefined;
    const activeOnly = req.query.active_only === 'true';

    const questionnaires = await questionnaireService.getQuestionnaires(projectType, activeOnly);
    sendSuccess(res, { questionnaires });
  })
);

// =====================================================
// ADMIN ENDPOINTS - RESPONSES
// =====================================================

/**
 * @swagger
 * /api/questionnaires/responses:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Get all questionnaire responses (admin)
 *     description: Returns all questionnaire responses with optional filters.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: project_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of questionnaire responses
 */
router.get(
  '/responses',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.query.client_id ? parseInt(req.query.client_id as string, 10) : undefined;
    const projectId = req.query.project_id ? parseInt(req.query.project_id as string, 10) : undefined;
    const status = req.query.status as string | undefined;

    const responses = await questionnaireService.getAllResponses({
      clientId,
      projectId,
      status: status as 'pending' | 'in_progress' | 'completed' | undefined
    });
    sendSuccess(res, { questionnaires: responses });
  })
);

/**
 * @swagger
 * /api/questionnaires/{id}:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Get a specific questionnaire (admin)
 *     description: Returns a specific questionnaire by ID.
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
 *         description: Questionnaire details
 *       404:
 *         description: Questionnaire not found
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid questionnaire ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const questionnaire = await questionnaireService.getQuestionnaire(id);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, { questionnaire });
  })
);

/**
 * @swagger
 * /api/questionnaires:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Create a new questionnaire (admin)
 *     description: Creates a new questionnaire with questions.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, questions]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               project_type:
 *                 type: string
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *               is_active:
 *                 type: boolean
 *               auto_send_on_project_create:
 *                 type: boolean
 *               display_order:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Questionnaire created
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(QuestionnaireValidationSchemas.create, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const {
      name,
      description,
      project_type,
      questions,
      is_active,
      auto_send_on_project_create,
      display_order
    } = req.body;

    if (!name || !questions || !Array.isArray(questions)) {
      return errorResponse(res, 'name and questions array are required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const createdBy = req.user?.email;

    const questionnaire = await questionnaireService.createQuestionnaire({
      name,
      description,
      project_type,
      questions,
      is_active,
      auto_send_on_project_create,
      display_order,
      created_by: createdBy
    });

    sendCreated(res, { questionnaire }, 'Questionnaire created');
  })
);

/**
 * @swagger
 * /api/questionnaires/{id}:
 *   put:
 *     tags: [Questionnaires]
 *     summary: Update a questionnaire (admin)
 *     description: Updates an existing questionnaire.
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
 *         description: Questionnaire updated
 *       404:
 *         description: Questionnaire not found
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest(QuestionnaireValidationSchemas.update, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid questionnaire ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const questionnaire = await questionnaireService.updateQuestionnaire(id, req.body);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, { questionnaire }, 'Questionnaire updated');
  })
);

/**
 * @swagger
 * /api/questionnaires/{id}:
 *   delete:
 *     tags: [Questionnaires]
 *     summary: Delete a questionnaire (admin)
 *     description: Deletes a questionnaire.
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
 *         description: Questionnaire deleted
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid questionnaire ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await questionnaireService.deleteQuestionnaire(id);

    sendSuccess(res, undefined, 'Questionnaire deleted');
  })
);

/**
 * @swagger
 * /api/questionnaires/bulk-delete:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Bulk delete questionnaires (admin)
 *     description: Deletes multiple questionnaires at once.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionnaireIds]
 *             properties:
 *               questionnaireIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Questionnaires deleted
 */
router.post(
  '/bulk-delete',
  authenticateToken,
  requireAdmin,
  validateRequest(QuestionnaireValidationSchemas.bulkDelete),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { questionnaireIds } = req.body;

    if (!questionnaireIds || !Array.isArray(questionnaireIds) || questionnaireIds.length === 0) {
      return errorResponse(res, 'questionnaireIds array is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    let deleted = 0;

    for (const questionnaireId of questionnaireIds) {
      const id = typeof questionnaireId === 'string' ? parseInt(questionnaireId, 10) : questionnaireId;
      if (isNaN(id) || id <= 0) continue;

      try {
        await questionnaireService.deleteQuestionnaire(id);
        deleted++;
      } catch {
        // Skip questionnaires that don't exist or can't be deleted
      }
    }

    sendSuccess(res, { deleted }, `${deleted} questionnaire(s) deleted`);
  })
);

/**
 * @swagger
 * /api/questionnaires/responses/pending:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Get all pending responses (admin)
 *     description: Returns all pending questionnaire responses.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending responses
 */
router.get(
  '/responses/pending',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const responses = await questionnaireService.getPendingResponses();
    sendSuccess(res, { responses });
  })
);

/**
 * @swagger
 * /api/questionnaires/{id}/send:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Send questionnaire to a client (admin)
 *     description: Sends a questionnaire to a specific client, creating a response record.
 *     security:
 *       - BearerAuth: []
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
 *             required: [client_id]
 *             properties:
 *               client_id:
 *                 type: integer
 *               project_id:
 *                 type: integer
 *               due_date:
 *                 type: string
 *     responses:
 *       201:
 *         description: Questionnaire sent to client
 *       400:
 *         description: Already sent to this client
 *       404:
 *         description: Questionnaire not found
 */
router.post(
  '/:id/send',
  authenticateToken,
  requireAdmin,
  validateRequest(QuestionnaireValidationSchemas.send, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const questionnaireId = parseInt(req.params.id, 10);
    const { client_id, project_id, due_date } = req.body;

    if (isNaN(questionnaireId) || questionnaireId <= 0) {
      return errorResponse(res, 'Invalid questionnaire ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!client_id) {
      return errorResponse(res, 'client_id is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    // Check if questionnaire exists
    const questionnaire = await questionnaireService.getQuestionnaire(questionnaireId);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if already sent
    const existing = await questionnaireService.getClientResponseForQuestionnaire(
      client_id,
      questionnaireId
    );
    if (existing) {
      return errorResponseWithPayload(
        res,
        'Questionnaire already sent to this client',
        400,
        undefined,
        {
          existing_response_id: existing.id
        }
      );
    }

    const response = await questionnaireService.sendQuestionnaire({
      questionnaire_id: questionnaireId,
      client_id,
      project_id,
      due_date
    });

    sendCreated(res, { response }, 'Questionnaire sent to client');
  })
);

/**
 * @swagger
 * /api/questionnaires/client/{clientId}/responses:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Get responses for a specific client (admin)
 *     description: Returns all questionnaire responses for a specific client.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client responses with stats
 */
router.get(
  '/client/:clientId/responses',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId, 10);
    const status = req.query.status as ResponseStatus | undefined;

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const responses = await questionnaireService.getClientResponses(clientId, status);
    const stats = await questionnaireService.getClientStats(clientId);

    sendSuccess(res, { responses, stats });
  })
);

/**
 * @swagger
 * /api/questionnaires/responses/{id}/remind:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Send reminder for a response (admin)
 *     description: Sends a reminder notification for a pending questionnaire response.
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
 *         description: Reminder sent
 */
router.post(
  '/responses/:id/remind',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const responseId = parseInt(req.params.id, 10);

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const response = await questionnaireService.sendReminder(responseId);

    sendSuccess(res, { response }, 'Reminder sent');
  })
);

/**
 * @swagger
 * /api/questionnaires/responses/{id}:
 *   delete:
 *     tags: [Questionnaires]
 *     summary: Delete a response (admin)
 *     description: Deletes a questionnaire response.
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
 *         description: Response deleted
 */
router.delete(
  '/responses/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const responseId = parseInt(req.params.id, 10);

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await questionnaireService.deleteResponse(responseId);

    sendSuccess(res, undefined, 'Response deleted');
  })
);

export default router;
