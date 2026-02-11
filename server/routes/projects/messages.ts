import express, { Response } from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject } from '../../middleware/access-control.js';
import { errorResponse } from '../../utils/api-response.js';

const router = express.Router();

// Get messages for a project
router.get(
  '/:id/messages',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const messages = await db.all(
      `
    SELECT id, sender_type, sender_name, message, read_at, created_at
    FROM messages
    WHERE project_id = ?
    ORDER BY created_at ASC
  `,
      [projectId]
    );

    res.json({ messages });
  })
);

// Add message to project
router.post(
  '/:id/messages',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return errorResponse(res, 'Message content is required', 400, 'MISSING_MESSAGE');
    }

    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Map 'admin' to 'developer' for messages table constraint compatibility
    // (messages table uses 'client', 'developer', 'system'; general_messages uses 'client', 'admin', 'system')
    const senderType = req.user!.type === 'admin' ? 'developer' : req.user!.type;

    const result = await db.run(
      `
    INSERT INTO messages (project_id, sender_type, sender_name, message)
    VALUES (?, ?, ?, ?)
  `,
      [
        projectId,
        senderType,
        req.user!.email, // or get actual name from user profile
        message.trim()
      ]
    );

    const newMessage = await db.get(
      `
    SELECT id, sender_type, sender_name, message, read_at, created_at
    FROM messages WHERE id = ?
  `,
      [result.lastID]
    );

    res.status(201).json({
      message: 'Message sent successfully',
      messageData: newMessage
    });
  })
);

// Mark messages as read
router.put(
  '/:id/messages/read',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    await db.run(
      `
    UPDATE messages 
    SET read_at = CURRENT_TIMESTAMP
    WHERE project_id = ? AND sender_type != ? AND read_at IS NULL
  `,
      [projectId, req.user!.type]
    );

    res.json({
      message: 'Messages marked as read'
    });
  })
);

export default router;
