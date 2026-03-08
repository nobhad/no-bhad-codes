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
  sendCreated
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
 * Get all questionnaire responses for the authenticated client
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
 * Get a specific response with questionnaire details (for answering)
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
      return errorResponse(res, 'Invalid response ID', 400, 'VALIDATION_ERROR');
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
 * Save progress on a questionnaire response
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
      return errorResponse(res, 'Invalid response ID', 400, 'VALIDATION_ERROR');
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
 * Submit a completed questionnaire response
 * On completion: generates PDF, saves to project Files, emits workflow event
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
      return errorResponse(res, 'Invalid response ID', 400, 'VALIDATION_ERROR');
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
 * Get all questionnaires (admin)
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
 * Get a specific questionnaire (admin)
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid questionnaire ID', 400, 'VALIDATION_ERROR');
    }

    const questionnaire = await questionnaireService.getQuestionnaire(id);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404);
    }

    sendSuccess(res, { questionnaire });
  })
);

/**
 * Create a new questionnaire (admin)
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
 * Update a questionnaire (admin)
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest(QuestionnaireValidationSchemas.update, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid questionnaire ID', 400, 'VALIDATION_ERROR');
    }

    const questionnaire = await questionnaireService.updateQuestionnaire(id, req.body);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404);
    }

    sendSuccess(res, { questionnaire }, 'Questionnaire updated');
  })
);

/**
 * Delete a questionnaire (admin)
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid questionnaire ID', 400, 'VALIDATION_ERROR');
    }

    await questionnaireService.deleteQuestionnaire(id);

    sendSuccess(res, undefined, 'Questionnaire deleted');
  })
);

/**
 * Bulk delete questionnaires (admin)
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
      if (isNaN(id)) continue;

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
 * Get all pending responses (admin)
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
 * Send a questionnaire to a client (admin)
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
      return errorResponse(res, 'Invalid questionnaire ID', 400, 'VALIDATION_ERROR');
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
 * Get responses for a specific client (admin)
 */
router.get(
  '/client/:clientId/responses',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId, 10);
    const status = req.query.status as ResponseStatus | undefined;

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, 'VALIDATION_ERROR');
    }

    const responses = await questionnaireService.getClientResponses(clientId, status);
    const stats = await questionnaireService.getClientStats(clientId);

    sendSuccess(res, { responses, stats });
  })
);

/**
 * Send reminder for a response (admin)
 */
router.post(
  '/responses/:id/remind',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const responseId = parseInt(req.params.id, 10);

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, 'VALIDATION_ERROR');
    }

    const response = await questionnaireService.sendReminder(responseId);

    sendSuccess(res, { response }, 'Reminder sent');
  })
);

/**
 * Delete a response (admin)
 */
router.delete(
  '/responses/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const responseId = parseInt(req.params.id, 10);

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, 'VALIDATION_ERROR');
    }

    await questionnaireService.deleteResponse(responseId);

    sendSuccess(res, undefined, 'Response deleted');
  })
);

// =====================================================
// PDF AND DATA EXPORT ENDPOINTS
// =====================================================

/**
 * Download questionnaire response as PDF (admin)
 */
router.get(
  '/responses/:id/pdf',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const responseId = parseInt(req.params.id, 10);

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, 'VALIDATION_ERROR');
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
 * Export questionnaire response as JSON (admin)
 */
router.get(
  '/responses/:id/export',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const responseId = parseInt(req.params.id, 10);

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, 'VALIDATION_ERROR');
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
 * Regenerate PDF for a completed questionnaire response (admin)
 * Useful if PDF was not generated on completion or needs to be updated
 */
router.post(
  '/responses/:id/regenerate-pdf',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const responseId = parseInt(req.params.id, 10);

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, 'VALIDATION_ERROR');
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
