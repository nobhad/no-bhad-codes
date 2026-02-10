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
      return res.status(401).json({ error: 'Not authenticated' });
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
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (isNaN(responseId)) {
      return res.status(400).json({ error: 'Invalid response ID' });
    }

    const response = await questionnaireService.getResponse(responseId);

    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }

    // Verify client owns this response (unless admin)
    if (req.user?.type !== 'admin' && response.client_id !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
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
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (isNaN(responseId)) {
      return res.status(400).json({ error: 'Invalid response ID' });
    }

    // Verify ownership
    const existing = await questionnaireService.getResponse(responseId);
    if (!existing) {
      return res.status(404).json({ error: 'Response not found' });
    }

    if (existing.client_id !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
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
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (isNaN(responseId)) {
      return res.status(400).json({ error: 'Invalid response ID' });
    }

    // Verify ownership
    const existing = await questionnaireService.getResponse(responseId);
    if (!existing) {
      return res.status(404).json({ error: 'Response not found' });
    }

    if (existing.client_id !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (existing.status === 'completed') {
      return res.status(400).json({ error: 'Questionnaire already submitted' });
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
      return res.status(400).json({ error: 'Invalid questionnaire ID' });
    }

    const questionnaire = await questionnaireService.getQuestionnaire(id);
    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
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
      return res.status(400).json({ error: 'name and questions array are required' });
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
      return res.status(400).json({ error: 'Invalid questionnaire ID' });
    }

    const questionnaire = await questionnaireService.updateQuestionnaire(id, req.body);
    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
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
      return res.status(400).json({ error: 'Invalid questionnaire ID' });
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
      return res.status(400).json({ error: 'Invalid questionnaire ID' });
    }

    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    // Check if questionnaire exists
    const questionnaire = await questionnaireService.getQuestionnaire(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    // Check if already sent
    const existing = await questionnaireService.getClientResponseForQuestionnaire(client_id, questionnaireId);
    if (existing) {
      return res.status(400).json({
        error: 'Questionnaire already sent to this client',
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
      return res.status(400).json({ error: 'Invalid client ID' });
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
      return res.status(400).json({ error: 'Invalid response ID' });
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
      return res.status(400).json({ error: 'Invalid response ID' });
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
