/**
 * ===============================================
 * QUESTIONNAIRE ROUTES — CLIENT
 * ===============================================
 * @file server/routes/questionnaires/client.ts
 *
 * Client-facing endpoints for questionnaire responses
 */

import { logger } from '../../services/logger.js';
import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { questionnaireService, ResponseStatus } from '../../services/questionnaire-service.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import {
  errorResponse,
  sendSuccess,
  ErrorCodes
} from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';
import { QuestionnaireValidationSchemas } from './shared.js';

const router = express.Router();

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
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
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
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const response = await questionnaireService.getResponse(responseId);

    if (!response) {
      return errorResponse(res, 'Response not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Verify client owns this response (unless admin)
    if (req.user?.type !== 'admin' && response.client_id !== clientId) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.FORBIDDEN);
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
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify ownership
    const existing = await questionnaireService.getResponse(responseId);
    if (!existing) {
      return errorResponse(res, 'Response not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (existing.client_id !== clientId) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.FORBIDDEN);
    }

    // Validate answer payload size
    const MAX_ANSWERS_SIZE = 100000; // 100KB
    const answersJson = JSON.stringify(answers || {});
    if (answersJson.length > MAX_ANSWERS_SIZE) {
      return errorResponse(res, 'Answers data too large', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    if (isNaN(responseId) || responseId <= 0) {
      return errorResponse(res, 'Invalid response ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify ownership
    const existing = await questionnaireService.getResponse(responseId);
    if (!existing) {
      return errorResponse(res, 'Response not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (existing.client_id !== clientId) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.FORBIDDEN);
    }

    if (existing.status === 'completed') {
      return errorResponse(res, 'Questionnaire already submitted', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate answer payload size
    const MAX_ANSWERS_SIZE = 100000; // 100KB
    const answersJson = JSON.stringify(answers || {});
    if (answersJson.length > MAX_ANSWERS_SIZE) {
      return errorResponse(res, 'Answers data too large', 400, ErrorCodes.VALIDATION_ERROR);
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

export default router;
