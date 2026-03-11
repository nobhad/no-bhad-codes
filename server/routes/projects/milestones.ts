import express, { Response } from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject } from '../../middleware/access-control.js';
import { getString } from '../../database/row-helpers.js';
import { logger } from '../../services/logger.js';
import { errorResponse, sendSuccess, sendCreated, messageResponse, ErrorCodes } from '../../utils/api-response.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import { softDeleteService } from '../../services/soft-delete-service.js';

// Explicit column lists for SELECT queries (avoid SELECT *)
const MILESTONE_COLUMNS = `
  id, project_id, title, description, due_date, completed_date,
  is_completed, deliverables, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

/** Individual deliverable within a milestone */
interface DeliverableEntry {
  text: string;
  completed: boolean;
}

/** Milestone row from database query with task counts */
interface MilestoneRow {
  [key: string]: unknown;  // Index signature for DatabaseRow compatibility
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_date: string | null;
  is_completed: number;
  deliverables: string | DeliverableEntry[];
  created_at: string;
  updated_at: string;
  task_count?: number;
  completed_task_count?: number;
  progress_percentage?: number;
}

/**
 * Normalize deliverables from legacy string[] format to DeliverableEntry[].
 * Handles both old format (["text1", "text2"]) and new format ([{text, completed}]).
 */
function normalizeDeliverables(raw: unknown): DeliverableEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    if (typeof item === 'string') {
      return { text: item, completed: false };
    }
    if (item && typeof item === 'object' && 'text' in item) {
      return {
        text: String((item as Record<string, unknown>).text),
        completed: Boolean((item as Record<string, unknown>).completed)
      };
    }
    return { text: String(item), completed: false };
  });
}

const router = express.Router();

// Get milestones for a project
router.get(
  '/:id/milestones',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
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
    LEFT JOIN project_tasks t ON m.id = t.milestone_id AND t.deleted_at IS NULL
    WHERE m.project_id = ? AND m.deleted_at IS NULL
    GROUP BY m.id
    ORDER BY m.due_date ASC, m.created_at ASC
  `,
      [projectId]
    );

    // Parse deliverables JSON (normalize legacy string[] → DeliverableEntry[])
    (milestones as MilestoneRow[]).forEach((milestone) => {
      const deliverablesStr = getString(milestone, 'deliverables');
      if (deliverablesStr) {
        try {
          milestone.deliverables = normalizeDeliverables(JSON.parse(deliverablesStr));
        } catch (_e) {
          logger.debug('[Milestones] Failed to parse milestone deliverables JSON', {
            error: _e instanceof Error ? _e : undefined
          });
          milestone.deliverables = [];
        }
      } else {
        milestone.deliverables = [];
      }

      // Calculate progress percentage — prefer deliverable completion, fallback to tasks
      const deliverablesList = milestone.deliverables as DeliverableEntry[];
      if (deliverablesList.length > 0) {
        const completedDeliverables = deliverablesList.filter((d) => d.completed).length;
        milestone.progress_percentage = Math.round((completedDeliverables / deliverablesList.length) * 100);
      } else {
        const taskCount = milestone.task_count || 0;
        const completedCount = milestone.completed_task_count || 0;
        milestone.progress_percentage =
          taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;
      }
    });

    sendSuccess(res, { milestones });
  })
);

// Create new milestone (admin only)
router.post(
  '/:id/milestones',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { title, description, due_date, deliverables = [] } = req.body;

    if (!title) {
      return errorResponse(res, 'Milestone title is required', 400, ErrorCodes.MISSING_TITLE);
    }

    const db = getDatabase();

    // Verify project exists
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
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
        ErrorCodes.MILESTONE_CREATION_ERROR
      );
    }

    // Parse deliverables JSON (normalize to DeliverableEntry[])
    const newMilestoneDeliverablesStr = getString(newMilestone, 'deliverables');
    if (newMilestoneDeliverablesStr) {
      try {
        newMilestone.deliverables = normalizeDeliverables(JSON.parse(newMilestoneDeliverablesStr));
      } catch (_e) {
        logger.debug('[Milestones] Failed to parse new milestone deliverables JSON', {
          error: _e instanceof Error ? _e : undefined
        });
        newMilestone.deliverables = [];
      }
    } else {
      newMilestone.deliverables = [];
    }

    sendCreated(res, { milestone: newMilestone }, 'Milestone created successfully');
  })
);

// Update milestone (admin only)
router.put(
  '/:id/milestones/:milestoneId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    const milestoneId = parseInt(req.params.milestoneId, 10);
    if (isNaN(projectId) || projectId <= 0 || isNaN(milestoneId) || milestoneId <= 0) {
      return errorResponse(res, 'Invalid project or milestone ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { title, description, due_date, deliverables, is_completed } = req.body;

    const db = getDatabase();

    // Verify milestone belongs to project
    const milestone = await db.get(`SELECT ${MILESTONE_COLUMNS} FROM milestones WHERE id = ? AND project_id = ?`, [
      milestoneId,
      projectId
    ]);

    if (!milestone) {
      return errorResponse(res, 'Milestone not found', 404, ErrorCodes.MILESTONE_NOT_FOUND);
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

      // Auto-complete milestone when all deliverables are done
      const normalized = normalizeDeliverables(deliverables);
      if (normalized.length > 0) {
        const allCompleted = normalized.every((d) => d.completed);
        const wasCompleted = Boolean(milestone.is_completed);

        if (allCompleted && !wasCompleted) {
          updates.push('is_completed = ?');
          values.push(1);
          updates.push('completed_date = ?');
          values.push(new Date().toISOString());

          await workflowTriggerService.emit('project.milestone_completed', {
            entityId: milestoneId,
            triggeredBy: 'admin',
            projectId,
            milestoneTitle: title || getString(milestone, 'title') || ''
          });
        } else if (!allCompleted && wasCompleted) {
          updates.push('is_completed = ?');
          values.push(0);
          updates.push('completed_date = ?');
          values.push(null);
        }
      }
    }
    if (is_completed !== undefined && deliverables === undefined) {
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
      return errorResponse(res, 'No valid fields to update', 400, ErrorCodes.NO_UPDATES);
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
        ErrorCodes.MILESTONE_UPDATE_ERROR
      );
    }

    // Parse deliverables JSON (normalize to DeliverableEntry[])
    const updatedMilestoneDeliverablesStr = getString(updatedMilestone, 'deliverables');
    if (updatedMilestoneDeliverablesStr) {
      try {
        updatedMilestone.deliverables = normalizeDeliverables(JSON.parse(updatedMilestoneDeliverablesStr));
      } catch (_e) {
        logger.debug('[Milestones] Failed to parse updated milestone deliverables JSON', {
          error: _e instanceof Error ? _e : undefined
        });
        updatedMilestone.deliverables = [];
      }
    } else {
      updatedMilestone.deliverables = [];
    }

    sendSuccess(res, { milestone: updatedMilestone }, 'Milestone updated successfully');
  })
);

// Delete milestone (admin only)
router.delete(
  '/:id/milestones/:milestoneId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    const milestoneId = parseInt(req.params.milestoneId, 10);
    if (isNaN(projectId) || projectId <= 0 || isNaN(milestoneId) || milestoneId <= 0) {
      return errorResponse(res, 'Invalid project or milestone ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const db = getDatabase();

    // Verify milestone belongs to project
    const milestone = await db.get('SELECT id FROM milestones WHERE id = ? AND project_id = ? AND deleted_at IS NULL', [
      milestoneId,
      projectId
    ]);

    if (!milestone) {
      return errorResponse(res, 'Milestone not found', 404, ErrorCodes.MILESTONE_NOT_FOUND);
    }

    const adminEmail = req.user?.email || 'admin';
    await softDeleteService.softDelete('milestone', milestoneId, adminEmail);

    messageResponse(res, 'Milestone deleted successfully');
  })
);

export { router as milestonesRouter };
export default router;
