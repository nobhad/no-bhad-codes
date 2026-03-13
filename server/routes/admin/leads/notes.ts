/**
 * ===============================================
 * LEAD ROUTES — NOTES
 * ===============================================
 * Lead notes CRUD and pin toggle.
 */

import express from 'express';
import { asyncHandler } from '../../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../../middleware/auth.js';
import { leadService } from '../../../services/lead-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../../utils/api-response.js';

const router = express.Router();

/**
 * @swagger
 * /api/admin/leads/{id}/notes:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/:id/notes
 *     description: Get notes for a specific lead.
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
  '/leads/:id/notes',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const notes = await leadService.getNotes(projectId);
    sendSuccess(res, { notes });
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/notes:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/:id/notes
 *     description: Add a note to a specific lead.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/leads/:id/notes',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { content } = req.body;

    if (!content) {
      return errorResponse(res, 'Content is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const note = await leadService.addNote(projectId, req.user?.email || 'admin', content);
    sendCreated(res, { note });
  })
);

/**
 * @swagger
 * /api/admin/leads/notes/{noteId}/toggle-pin:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/notes/:noteId/toggle-pin
 *     description: Pin or unpin a lead note.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/leads/notes/:noteId/toggle-pin',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const noteId = parseInt(req.params.noteId, 10);
    if (isNaN(noteId) || noteId <= 0) {
      return errorResponse(res, 'Invalid note ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const note = await leadService.togglePinNote(noteId);
    sendSuccess(res, { note });
  })
);

/**
 * @swagger
 * /api/admin/leads/notes/{noteId}:
 *   delete:
 *     tags:
 *       - Admin
 *     summary: DELETE /api/admin/leads/notes/:noteId
 *     description: Delete a lead note.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.delete(
  '/leads/notes/:noteId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const noteId = parseInt(req.params.noteId, 10);
    if (isNaN(noteId) || noteId <= 0) {
      return errorResponse(res, 'Invalid note ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    await leadService.deleteNote(noteId);
    sendSuccess(res, undefined, 'Note deleted');
  })
);

export default router;
