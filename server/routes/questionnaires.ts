import { logger } from '../services/logger.js';
/**
 * ===============================================
 * QUESTIONNAIRE ROUTES
 * ===============================================
 * @file server/routes/questionnaires.ts
 *
 * API endpoints for managing questionnaires and responses
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { questionnaireService, ResponseStatus } from '../services/questionnaire-service.js';
import { workflowTriggerService } from '../services/workflow-trigger-service.js';
import {
  errorResponse,
  errorResponseWithPayload,
  sendSuccess,
  sendCreated,
  ErrorCodes
} from '../utils/api-response.js';
import { sendPdfResponse } from '../utils/pdf-generator.js';
import { validateRequest, ValidationSchema } from '../middleware/validation.js';

const router = express.Router();

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const QUESTIONNAIRE_NAME_MAX_LENGTH = 200;
const QUESTIONNAIRE_DESCRIPTION_MAX_LENGTH = 5000;
const QUESTIONS_MAX_COUNT = 100;
const PROJECT_TYPE_MAX_LENGTH = 50;
const DISPLAY_ORDER_MAX = 9999;
const BULK_DELETE_MAX_IDS = 100;

const QuestionnaireValidationSchemas = {
  create: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: QUESTIONNAIRE_NAME_MAX_LENGTH }
    ],
    questions: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: QUESTIONS_MAX_COUNT }
    ],
    description: { type: 'string' as const, maxLength: QUESTIONNAIRE_DESCRIPTION_MAX_LENGTH },
    project_type: { type: 'string' as const, maxLength: PROJECT_TYPE_MAX_LENGTH },
    is_active: { type: 'boolean' as const },
    auto_send_on_project_create: { type: 'boolean' as const },
    display_order: { type: 'number' as const, min: 0, max: DISPLAY_ORDER_MAX }
  } as ValidationSchema,

  update: {
    name: { type: 'string' as const, minLength: 1, maxLength: QUESTIONNAIRE_NAME_MAX_LENGTH },
    description: { type: 'string' as const, maxLength: QUESTIONNAIRE_DESCRIPTION_MAX_LENGTH },
    questions: { type: 'array' as const, maxLength: QUESTIONS_MAX_COUNT },
    project_type: { type: 'string' as const, maxLength: PROJECT_TYPE_MAX_LENGTH },
    is_active: { type: 'boolean' as const },
    auto_send_on_project_create: { type: 'boolean' as const },
    display_order: { type: 'number' as const, min: 0, max: DISPLAY_ORDER_MAX }
  } as ValidationSchema,

  bulkDelete: {
    questionnaireIds: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: BULK_DELETE_MAX_IDS }
    ]
  } as ValidationSchema,

  send: {
    client_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    project_id: { type: 'number' as const, min: 1 },
    due_date: { type: 'string' as const, maxLength: 30 }
  } as ValidationSchema,

  saveProgress: {
    answers: { type: 'object' as const }
  } as ValidationSchema,

  submitResponse: {
    answers: { type: 'object' as const }
  } as ValidationSchema
};

// =====================================================
// CLIENT ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/questionnaires/my-responses:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Get client questionnaire responses
 *     description: Returns all questionnaire responses for the authenticated client with stats.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client responses with stats
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/my-responses',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const status = req.query.status as ResponseStatus | undefined;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    const responses = await questionnaireService.getClientResponses(clientId, status);
    const stats = await questionnaireService.getClientStats(clientId);

    sendSuccess(res, { responses, stats });
  })
);

/**
 * @swagger
 * /api/questionnaires/responses/{id}:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Get a specific response
 *     description: Returns a specific questionnaire response with full questionnaire details.
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
 *         description: Response with questionnaire details
 *       403:
 *         description: Access denied
 *       404:
 *         description: Response not found
 */
router.get(
  '/responses/:id',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const responseId = parseInt(req.params.id, 10);

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const response = await questionnaireService.getResponse(responseId);

    if (!response) {
      return errorResponse(res, 'Response not found', 404);
    }

    // Verify client owns this response (unless admin)
    if (req.user?.type !== 'admin' && response.client_id !== clientId) {
      return errorResponse(res, 'Access denied', 403);
    }

    // Get the full questionnaire
    const questionnaire = await questionnaireService.getQuestionnaire(response.questionnaire_id);

    sendSuccess(res, { response, questionnaire });
  })
);

/**
 * @swagger
 * /api/questionnaires/responses/{id}/save:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Save progress on a response
 *     description: Saves partial answers without submitting the questionnaire.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answers:
 *                 type: object
 *     responses:
 *       200:
 *         description: Progress saved
 *       403:
 *         description: Access denied
 *       404:
 *         description: Response not found
 */
router.post(
  '/responses/:id/save',
  authenticateToken,
  validateRequest(QuestionnaireValidationSchemas.saveProgress, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const responseId = parseInt(req.params.id, 10);
    const { answers } = req.body;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify ownership
    const existing = await questionnaireService.getResponse(responseId);
    if (!existing) {
      return errorResponse(res, 'Response not found', 404);
    }

    if (existing.client_id !== clientId) {
      return errorResponse(res, 'Access denied', 403);
    }

    const response = await questionnaireService.saveProgress(responseId, answers || {});

    sendSuccess(res, { response }, 'Progress saved');
  })
);

/**
 * @swagger
 * /api/questionnaires/responses/{id}/submit:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Submit a completed response
 *     description: Submits a completed questionnaire response. Generates PDF and emits workflow event.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answers:
 *                 type: object
 *     responses:
 *       200:
 *         description: Questionnaire submitted
 *       400:
 *         description: Already submitted
 *       403:
 *         description: Access denied
 */
router.post(
  '/responses/:id/submit',
  authenticateToken,
  validateRequest(QuestionnaireValidationSchemas.submitResponse, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const responseId = parseInt(req.params.id, 10);
    const { answers } = req.body;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify ownership
    const existing = await questionnaireService.getResponse(responseId);
    if (!existing) {
      return errorResponse(res, 'Response not found', 404);
    }

    if (existing.client_id !== clientId) {
      return errorResponse(res, 'Access denied', 403);
    }

    if (existing.status === 'completed') {
      return errorResponse(res, 'Questionnaire already submitted', 400);
    }

    // Submit the response
    const response = await questionnaireService.submitResponse(responseId, answers || {});

    // Generate and save PDF to project Files if response has a project
    let exportedFileId: number | undefined;
    if (response.project_id) {
      try {
        exportedFileId = await questionnaireService.saveQuestionnairePdfToFiles(responseId);
      } catch (pdfError) {
        // Log error but don't fail the submission
        await logger.error(`[Questionnaire] Failed to generate PDF for response ${responseId}:`, {
          error: pdfError instanceof Error ? pdfError : undefined,
          category: 'QUESTIONNAIRE',
          metadata: { responseId }
        });
      }
    }

    // Emit workflow event
    await workflowTriggerService.emit('questionnaire.completed', {
      entityId: responseId,
      questionnaireId: response.questionnaire_id,
      questionnaireName: response.questionnaire_name,
      clientId: response.client_id,
      clientName: response.client_name,
      projectId: response.project_id,
      projectName: response.project_name,
      exportedFileId,
      completedAt: response.completed_at,
      triggeredBy: req.user?.email
    });

    sendSuccess(
      res,
      {
        response: {
          ...response,
          exported_file_id: exportedFileId
        }
      },
      'Questionnaire submitted'
    );
  })
);

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
      return errorResponse(res, 'Questionnaire not found', 404);
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
      return errorResponse(res, 'name and questions array are required', 400);
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
      return errorResponse(res, 'Questionnaire not found', 404);
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
      return errorResponse(res, 'questionnaireIds array is required', 400);
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

// =====================================================
// ADMIN ENDPOINTS - RESPONSES
// =====================================================

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
      return errorResponse(res, 'client_id is required', 400);
    }

    // Check if questionnaire exists
    const questionnaire = await questionnaireService.getQuestionnaire(questionnaireId);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404);
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

// =====================================================
// PDF AND DATA EXPORT ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/questionnaires/responses/{id}/pdf:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Download response as PDF (admin)
 *     description: Downloads a questionnaire response as a PDF document.
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
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Response not found
 */
router.get(
  '/responses/:id/pdf',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const responseId = parseInt(req.params.id, 10);

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const response = await questionnaireService.getResponse(responseId);
    if (!response) {
      return errorResponse(res, 'Response not found', 404);
    }

    const questionnaire = await questionnaireService.getQuestionnaire(response.questionnaire_id);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404);
    }

    // Generate PDF
    const pdfBytes = await questionnaireService.generateQuestionnairePdf(responseId);

    // Create filename
    const safeQuestionnaireName = questionnaire.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .substring(0, 30);
    const safeClientName = (response.client_name || 'client')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .substring(0, 30);

    sendPdfResponse(res, pdfBytes, {
      filename: `questionnaire_${safeQuestionnaireName}_${safeClientName}.pdf`,
      disposition: 'inline'
    });
  })
);

/**
 * @swagger
 * /api/questionnaires/responses/{id}/export:
 *   get:
 *     tags: [Questionnaires]
 *     summary: Export response as JSON (admin)
 *     description: Exports a questionnaire response as a JSON file download.
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
 *         description: JSON file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Response not found
 */
router.get(
  '/responses/:id/export',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const responseId = parseInt(req.params.id, 10);

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const response = await questionnaireService.getResponse(responseId);
    if (!response) {
      return errorResponse(res, 'Response not found', 404);
    }

    const questionnaire = await questionnaireService.getQuestionnaire(response.questionnaire_id);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404);
    }

    // Get JSON export
    const jsonData = await questionnaireService.exportQuestionnaireJson(responseId);

    // Create filename
    const safeQuestionnaireName = questionnaire.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .substring(0, 30);
    const timestamp = new Date().toISOString().substring(0, 10);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="questionnaire_${safeQuestionnaireName}_${timestamp}.json"`
    );
    res.send(jsonData);
  })
);

/**
 * @swagger
 * /api/questionnaires/responses/{id}/regenerate-pdf:
 *   post:
 *     tags: [Questionnaires]
 *     summary: Regenerate PDF for a response (admin)
 *     description: Regenerates the PDF for a completed questionnaire response and saves to project files.
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
 *         description: PDF regenerated
 *       400:
 *         description: Not completed or no project
 *       404:
 *         description: Response not found
 */
router.post(
  '/responses/:id/regenerate-pdf',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const responseId = parseInt(req.params.id, 10);

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const response = await questionnaireService.getResponse(responseId);
    if (!response) {
      return errorResponse(res, 'Response not found', 404);
    }

    if (response.status !== 'completed') {
      return errorResponse(res, 'Can only regenerate PDF for completed questionnaires', 400);
    }

    if (!response.project_id) {
      return errorResponse(res, 'Cannot save PDF: questionnaire has no associated project', 400);
    }

    // Generate and save PDF to project Files
    const exportedFileId = await questionnaireService.saveQuestionnairePdfToFiles(responseId);

    sendSuccess(
      res,
      { exported_file_id: exportedFileId },
      'PDF regenerated and saved to project files'
    );
  })
);

export { router as questionnairesRouter };
export default router;
