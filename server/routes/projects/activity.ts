import express, { Response } from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject, isUserAdmin } from '../../middleware/access-control.js';
import { getNumber } from '../../database/row-helpers.js';
import { userService } from '../../services/user-service.js';
import { errorResponse } from '../../utils/api-response.js';

const router = express.Router();

// Add project update (admin only)
router.post(
  '/:id/updates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id);
    const { title, description, update_type = 'general', author = 'Admin' } = req.body;

    if (!title) {
      return errorResponse(res, 'Update title is required', 400, 'MISSING_TITLE');
    }

    const db = getDatabase();

    // Verify project exists
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const validUpdateTypes = ['progress', 'milestone', 'issue', 'resolution', 'general'];
    if (!validUpdateTypes.includes(update_type)) {
      return errorResponse(res, 'Invalid update type', 400, 'INVALID_UPDATE_TYPE');
    }

    // Look up user ID for author
    const authorUserId = await userService.getUserIdByEmailOrName(author);

    const result = await db.run(
      `
    INSERT INTO project_updates (project_id, title, description, update_type, author_user_id)
    VALUES (?, ?, ?, ?, ?)
  `,
      [projectId, title, description || null, update_type, authorUserId]
    );

    const newUpdate = await db.get(
      `
    SELECT pu.id, pu.title, pu.description, pu.update_type, u.display_name as author, pu.created_at
    FROM project_updates pu
    LEFT JOIN users u ON pu.author_user_id = u.id
    WHERE pu.id = ?
  `,
      [result.lastID]
    );

    res.status(201).json({
      message: 'Project update added successfully',
      update: newUpdate
    });
  })
);

// Get project dashboard data
router.get(
  '/:id/dashboard',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const projectExists = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!projectExists) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const isAdmin = await isUserAdmin(req);
    const project = isAdmin
      ? await db.get(
        `
      SELECT p.*, c.company_name, c.contact_name, c.email as client_email
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?
    `,
        [projectId]
      )
      : await db.get(
        `
      SELECT * FROM projects 
      WHERE id = ? AND client_id = ?
    `,
        [projectId, req.user!.id]
      );

    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Get project statistics
    const stats = await db.get(
      `
    SELECT 
      COUNT(DISTINCT m.id) as total_milestones,
      COUNT(DISTINCT CASE WHEN m.is_completed = 1 THEN m.id END) as completed_milestones,
      COUNT(DISTINCT f.id) as total_files,
      COUNT(DISTINCT msg.id) as total_messages,
      COUNT(DISTINCT CASE WHEN msg.read_at IS NULL THEN msg.id END) as unread_messages,
      COUNT(DISTINCT u.id) as total_updates
    FROM projects p
    LEFT JOIN milestones m ON p.id = m.project_id
    LEFT JOIN files f ON p.id = f.project_id
    LEFT JOIN messages msg ON p.id = msg.project_id
    LEFT JOIN project_updates u ON p.id = u.project_id
    WHERE p.id = ?
  `,
      [projectId]
    );

    // Get recent milestones (next 3 upcoming)
    const upcomingMilestones = await db.all(
      `
    SELECT id, title, description, due_date, is_completed
    FROM milestones 
    WHERE project_id = ? AND is_completed = 0
    ORDER BY due_date ASC
    LIMIT 3
  `,
      [projectId]
    );

    // Get recent updates (last 5)
    const recentUpdates = await db.all(
      `
    SELECT pu.id, pu.title, pu.description, pu.update_type, u.display_name as author, pu.created_at
    FROM project_updates pu
    LEFT JOIN users u ON pu.author_user_id = u.id
    WHERE pu.project_id = ?
    ORDER BY pu.created_at DESC
    LIMIT 5
  `,
      [projectId]
    );

    // Get recent messages (last 5)
    const recentMessages = await db.all(
      `
    SELECT id, sender_type, sender_name, message, read_at, created_at
    FROM messages
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `,
      [projectId]
    );

    // Calculate progress percentage
    const totalMilestones = getNumber(stats, 'total_milestones');
    const completedMilestones = getNumber(stats, 'completed_milestones');
    const projectProgress = project ? getNumber(project, 'progress') : 0;
    const progressPercentage =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : projectProgress || 0;

    res.json({
      project,
      stats,
      progressPercentage,
      upcomingMilestones,
      recentUpdates,
      recentMessages
    });
  })
);

export { router as activityRouter };
export default router;
