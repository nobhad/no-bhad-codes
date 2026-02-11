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
import { errorResponse, errorResponseWithPayload } from '../utils/api-response.js';

const router = express.Router();

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

    res.json({ responses, stats });
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
    const responseId = parseInt(req.params.id);

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    if (isNaN(responseId)) {
      return errorResponse(res, 'Invalid response ID', 400);
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

    res.json({ response, questionnaire });
  })
);

/**
 * Save progress on a questionnaire response
 */
router.post(
  '/responses/:id/save',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const responseId = parseInt(req.params.id);
    const { answers } = req.body;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    if (isNaN(responseId)) {
      return errorResponse(res, 'Invalid response ID', 400);
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

    res.json({
      success: true,
      message: 'Progress saved',
      response
    });
  })
);

/**
 * Submit a completed questionnaire response
 */
router.post(
  '/responses/:id/submit',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const responseId = parseInt(req.params.id);
    const { answers } = req.body;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    if (isNaN(responseId)) {
      return errorResponse(res, 'Invalid response ID', 400);
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

    const response = await questionnaireService.submitResponse(responseId, answers || {});

    res.json({
      success: true,
      message: 'Questionnaire submitted',
      response
    });
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
    res.json({ questionnaires });
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
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid questionnaire ID', 400);
    }

    const questionnaire = await questionnaireService.getQuestionnaire(id);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404);
    }

    res.json({ questionnaire });
  })
);

/**
 * Create a new questionnaire (admin)
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
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

    res.status(201).json({
      success: true,
      message: 'Questionnaire created',
      questionnaire
    });
  })
);

/**
 * Update a questionnaire (admin)
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid questionnaire ID', 400);
    }

    const questionnaire = await questionnaireService.updateQuestionnaire(id, req.body);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404);
    }

    res.json({
      success: true,
      message: 'Questionnaire updated',
      questionnaire
    });
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
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid questionnaire ID', 400);
    }

    await questionnaireService.deleteQuestionnaire(id);

    res.json({
      success: true,
      message: 'Questionnaire deleted'
    });
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
    res.json({ responses });
  })
);

/**
 * Send a questionnaire to a client (admin)
 */
router.post(
  '/:id/send',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const questionnaireId = parseInt(req.params.id);
    const { client_id, project_id, due_date } = req.body;

    if (isNaN(questionnaireId)) {
      return errorResponse(res, 'Invalid questionnaire ID', 400);
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
    const existing = await questionnaireService.getClientResponseForQuestionnaire(client_id, questionnaireId);
    if (existing) {
      return errorResponseWithPayload(res, 'Questionnaire already sent to this client', 400, undefined, {
        existing_response_id: existing.id
      });
    }

    const response = await questionnaireService.sendQuestionnaire({
      questionnaire_id: questionnaireId,
      client_id,
      project_id,
      due_date
    });

    res.status(201).json({
      success: true,
      message: 'Questionnaire sent to client',
      response
    });
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
    const clientId = parseInt(req.params.clientId);
    const status = req.query.status as ResponseStatus | undefined;

    if (isNaN(clientId)) {
      return errorResponse(res, 'Invalid client ID', 400);
    }

    const responses = await questionnaireService.getClientResponses(clientId, status);
    const stats = await questionnaireService.getClientStats(clientId);

    res.json({ responses, stats });
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
    const responseId = parseInt(req.params.id);

    if (isNaN(responseId)) {
      return errorResponse(res, 'Invalid response ID', 400);
    }

    const response = await questionnaireService.sendReminder(responseId);

    res.json({
      success: true,
      message: 'Reminder sent',
      response
    });
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
    const responseId = parseInt(req.params.id);

    if (isNaN(responseId)) {
      return errorResponse(res, 'Invalid response ID', 400);
    }

    await questionnaireService.deleteResponse(responseId);

    res.json({
      success: true,
      message: 'Response deleted'
    });
  })
);

export { router as questionnairesRouter };
export default router;
