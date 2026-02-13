import express, { Response } from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject } from '../../middleware/access-control.js';
import { getString } from '../../database/row-helpers.js';
import { errorResponse } from '../../utils/api-response.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';

const router = express.Router();

// Get milestones for a project
router.get(
  '/:id/milestones',
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

    const milestones = await db.all(
      `
    SELECT
      m.id,
      m.title,
      m.description,
      m.due_date,
      m.completed_date,
      m.is_completed,
      m.deliverables,
      m.created_at,
      m.updated_at,
      COUNT(t.id) as task_count,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_task_count
    FROM milestones m
    LEFT JOIN project_tasks t ON m.id = t.milestone_id
    WHERE m.project_id = ?
    GROUP BY m.id
    ORDER BY m.due_date ASC, m.created_at ASC
  `,
      [projectId]
    );

    // Parse deliverables JSON and calculate progress
    milestones.forEach((milestone: any) => {
      const deliverablesStr = getString(milestone, 'deliverables');
      if (deliverablesStr) {
        try {
          milestone.deliverables = JSON.parse(deliverablesStr);
        } catch (_e) {
          milestone.deliverables = [];
        }
      } else {
        milestone.deliverables = [];
      }

      // Calculate progress percentage
      const taskCount = milestone.task_count || 0;
      const completedCount = milestone.completed_task_count || 0;
      milestone.progress_percentage = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;
    });

    res.json({ milestones });
  })
);

// Create new milestone (admin only)
router.post(
  '/:id/milestones',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id);
    const { title, description, due_date, deliverables = [] } = req.body;

    if (!title) {
      return errorResponse(res, 'Milestone title is required', 400, 'MISSING_TITLE');
    }

    const db = getDatabase();

    // Verify project exists
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const result = await db.run(
      `
    INSERT INTO milestones (project_id, title, description, due_date, deliverables)
    VALUES (?, ?, ?, ?, ?)
  `,
      [projectId, title, description || null, due_date || null, JSON.stringify(deliverables)]
    );

    const newMilestone = await db.get(
      `
    SELECT id, title, description, due_date, completed_date, is_completed,
           deliverables, created_at, updated_at
    FROM milestones WHERE id = ?
  `,
      [result.lastID]
    );

    if (!newMilestone) {
      return errorResponse(
        res,
        'Milestone created but could not retrieve details',
        500,
        'MILESTONE_CREATION_ERROR'
      );
    }

    // Parse deliverables JSON
    const newMilestoneDeliverablesStr = getString(newMilestone, 'deliverables');
    if (newMilestoneDeliverablesStr) {
      try {
        newMilestone.deliverables = JSON.parse(newMilestoneDeliverablesStr);
      } catch (_e) {
        newMilestone.deliverables = [];
      }
    } else {
      newMilestone.deliverables = [];
    }

    res.status(201).json({
      message: 'Milestone created successfully',
      milestone: newMilestone
    });
  })
);

// Update milestone (admin only)
router.put(
  '/:id/milestones/:milestoneId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id);
    const milestoneId = parseInt(req.params.milestoneId);
    const { title, description, due_date, deliverables, is_completed } = req.body;

    const db = getDatabase();

    // Verify milestone belongs to project
    const milestone = await db.get('SELECT * FROM milestones WHERE id = ? AND project_id = ?', [
      milestoneId,
      projectId
    ]);

    if (!milestone) {
      return errorResponse(res, 'Milestone not found', 404, 'MILESTONE_NOT_FOUND');
    }

    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(due_date);
    }
    if (deliverables !== undefined) {
      updates.push('deliverables = ?');
      values.push(JSON.stringify(deliverables));
    }
    if (is_completed !== undefined) {
      updates.push('is_completed = ?');
      values.push(is_completed);

      if (is_completed && !milestone.is_completed) {
        // Mark as completed
        updates.push('completed_date = ?');
        values.push(new Date().toISOString());

        // Emit workflow event for milestone completion
        await workflowTriggerService.emit('project.milestone_completed', {
          entityId: milestoneId,
          triggeredBy: 'admin',
          projectId,
          milestoneTitle: title || milestone.title
        });
      } else if (!is_completed && milestone.is_completed) {
        // Mark as incomplete
        updates.push('completed_date = ?');
        values.push(null);
      }
    }

    if (updates.length === 0) {
      return errorResponse(res, 'No valid fields to update', 400, 'NO_UPDATES');
    }

    values.push(milestoneId);

    await db.run(
      `
    UPDATE milestones
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
      values
    );

    const updatedMilestone = await db.get(
      `
    SELECT id, title, description, due_date, completed_date, is_completed,
           deliverables, created_at, updated_at
    FROM milestones WHERE id = ?
  `,
      [milestoneId]
    );

    if (!updatedMilestone) {
      return errorResponse(
        res,
        'Milestone updated but could not retrieve details',
        500,
        'MILESTONE_UPDATE_ERROR'
      );
    }

    // Parse deliverables JSON
    const updatedMilestoneDeliverablesStr = getString(updatedMilestone, 'deliverables');
    if (updatedMilestoneDeliverablesStr) {
      try {
        updatedMilestone.deliverables = JSON.parse(updatedMilestoneDeliverablesStr);
      } catch (_e) {
        updatedMilestone.deliverables = [];
      }
    } else {
      updatedMilestone.deliverables = [];
    }

    res.json({
      message: 'Milestone updated successfully',
      milestone: updatedMilestone
    });
  })
);

// Delete milestone (admin only)
router.delete(
  '/:id/milestones/:milestoneId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id);
    const milestoneId = parseInt(req.params.milestoneId);
    const db = getDatabase();

    // Verify milestone belongs to project
    const milestone = await db.get('SELECT id FROM milestones WHERE id = ? AND project_id = ?', [
      milestoneId,
      projectId
    ]);

    if (!milestone) {
      return errorResponse(res, 'Milestone not found', 404, 'MILESTONE_NOT_FOUND');
    }

    await db.run('DELETE FROM milestones WHERE id = ?', [milestoneId]);

    res.json({
      message: 'Milestone deleted successfully'
    });
  })
);

export { router as milestonesRouter };
export default router;
