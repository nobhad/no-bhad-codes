import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject } from '../../utils/access-control.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { messageService } from '../../services/message-service.js';
import { projectService } from '../../services/project-service.js';

const router = express.Router();

// Get messages for a project
router.get(
  '/:id/messages',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!(await projectService.projectExists(projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const messages = await messageService.getProjectMessages(projectId);
    sendSuccess(res, { messages });
  })
);

// Add message to project
router.post(
  '/:id/messages',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Accept both 'content' (frontend) and 'message' (legacy)
    const content = req.body.content || req.body.message;

    if (!content || content.trim().length === 0) {
      return errorResponse(res, 'Message content is required', 400, ErrorCodes.MISSING_MESSAGE);
    }

    if (!(await projectService.projectExists(projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    // Get client_id from project for unified table
    const clientId = await messageService.getProjectClientId(projectId);

    // Resolve display name: admin users → users.display_name, clients → clients.contact_name
    const senderName = await messageService.resolveSenderName(
      req.user!.id,
      req.user!.type,
      req.user!.email
    );

    const newMessage = await messageService.createProjectMessage({
      projectId,
      clientId,
      senderType: req.user!.type,
      senderName,
      content: content.trim()
    });

    sendCreated(res, newMessage, 'Message sent');
  })
);

// Mark messages as read
router.put(
  '/:id/messages/read',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!(await projectService.projectExists(projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    await messageService.markProjectMessagesRead(projectId, req.user!.type);
    sendSuccess(res, undefined, 'Messages marked as read');
  })
);

export default router;
