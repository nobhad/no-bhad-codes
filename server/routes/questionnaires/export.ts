/**
 * ===============================================
 * QUESTIONNAIRE ROUTES — EXPORT
 * ===============================================
 * @file server/routes/questionnaires/export.ts
 *
 * PDF and data export endpoints
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { questionnaireService } from '../../services/questionnaire-service.js';
import {
  errorResponse,
  sendSuccess,
  ErrorCodes
} from '../../utils/api-response.js';
import { sendPdfResponse } from '../../utils/pdf-generator.js';

const router = express.Router();

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
      return errorResponse(res, 'Response not found', 404, ErrorCodes.NOT_FOUND);
    }

    const questionnaire = await questionnaireService.getQuestionnaire(response.questionnaire_id);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404, ErrorCodes.NOT_FOUND);
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
      return errorResponse(res, 'Response not found', 404, ErrorCodes.NOT_FOUND);
    }

    const questionnaire = await questionnaireService.getQuestionnaire(response.questionnaire_id);
    if (!questionnaire) {
      return errorResponse(res, 'Questionnaire not found', 404, ErrorCodes.NOT_FOUND);
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
      return errorResponse(res, 'Response not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (response.status !== 'completed') {
      return errorResponse(res, 'Can only regenerate PDF for completed questionnaires', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!response.project_id) {
      return errorResponse(res, 'Cannot save PDF: questionnaire has no associated project', 400, ErrorCodes.VALIDATION_ERROR);
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

export default router;
