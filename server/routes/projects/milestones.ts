import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject } from '../../utils/access-control.js';
import { getString } from '../../database/row-helpers.js';
import { projectService } from '../../services/project-service.js';
import { normalizeDeliverables } from '../../services/project/milestones.js';
import { invalidateCache } from '../../middleware/cache.js';
import { errorResponse, sendSuccess, sendCreated, messageResponse, ErrorCodes } from '../../utils/api-response.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import { softDeleteService } from '../../services/soft-delete-service.js';

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

    const exists = await projectService.milestoneProjectExists(projectId);
    if (!exists) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const milestones = await projectService.getMilestones(projectId);

    sendSuccess(res, { milestones });
  })
);

// Create new milestone (admin only)
router.post(
  '/:id/milestones',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { title, description, due_date, deliverables = [] } = req.body;

    if (!title) {
      return errorResponse(res, 'Milestone title is required', 400, ErrorCodes.MISSING_TITLE);
    }

    // Verify project exists
    const exists = await projectService.milestoneProjectExists(projectId);
    if (!exists) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const newMilestone = await projectService.createMilestone({
      projectId,
      title,
      description: description || null,
      dueDate: due_date || null,
      deliverables
    });

    if (!newMilestone) {
      return errorResponse(
        res,
        'Milestone created but could not retrieve details',
        500,
        ErrorCodes.MILESTONE_CREATION_ERROR
      );
    }

    sendCreated(res, { milestone: newMilestone }, 'Milestone created successfully');
  })
);

// Update milestone (admin only)
router.put(
  '/:id/milestones/:milestoneId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    const milestoneId = parseInt(req.params.milestoneId, 10);
    if (isNaN(projectId) || projectId <= 0 || isNaN(milestoneId) || milestoneId <= 0) {
      return errorResponse(res, 'Invalid project or milestone ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { title, description, due_date, deliverables, is_completed } = req.body;

    // Verify milestone belongs to project
    const milestone = await projectService.getMilestoneByIdAndProject(milestoneId, projectId);

    if (!milestone) {
      return errorResponse(res, 'Milestone not found', 404, ErrorCodes.MILESTONE_NOT_FOUND);
    }

    // Build dynamic update fields
    const fields: Record<string, string | number | boolean | null> = {};

    if (title !== undefined) {
      fields.title = title;
    }
    if (description !== undefined) {
      fields.description = description;
    }
    if (due_date !== undefined) {
      fields.due_date = due_date;
    }
    if (deliverables !== undefined) {
      fields.deliverables = JSON.stringify(deliverables);

      // Auto-complete milestone when all deliverables are done
      const normalized = normalizeDeliverables(deliverables);
      if (normalized.length > 0) {
        const allCompleted = normalized.every((d) => d.completed);
        const wasCompleted = Boolean(milestone.is_completed);

        if (allCompleted && !wasCompleted) {
          fields.is_completed = 1;
          fields.completed_date = new Date().toISOString();

          await workflowTriggerService.emit('project.milestone_completed', {
            entityId: milestoneId,
            triggeredBy: 'admin',
            projectId,
            milestoneTitle: title || getString(milestone, 'title') || ''
          });
        } else if (!allCompleted && wasCompleted) {
          fields.is_completed = 0;
          fields.completed_date = null;
        }
      }
    }
    if (is_completed !== undefined && deliverables === undefined) {
      fields.is_completed = is_completed;

      if (is_completed && !milestone.is_completed) {
        // Mark as completed
        fields.completed_date = new Date().toISOString();

        // Emit workflow event for milestone completion
        await workflowTriggerService.emit('project.milestone_completed', {
          entityId: milestoneId,
          triggeredBy: 'admin',
          projectId,
          milestoneTitle: title || milestone.title
        });
      } else if (!is_completed && milestone.is_completed) {
        // Mark as incomplete
        fields.completed_date = null;
      }
    }

    if (Object.keys(fields).length === 0) {
      return errorResponse(res, 'No valid fields to update', 400, ErrorCodes.NO_UPDATES);
    }

    const updatedMilestone = await projectService.updateMilestone(milestoneId, fields);

    if (!updatedMilestone) {
      return errorResponse(
        res,
        'Milestone updated but could not retrieve details',
        500,
        ErrorCodes.MILESTONE_UPDATE_ERROR
      );
    }

    sendSuccess(res, { milestone: updatedMilestone }, 'Milestone updated successfully');
  })
);

// Delete milestone (admin only)
router.delete(
  '/:id/milestones/:milestoneId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    const milestoneId = parseInt(req.params.milestoneId, 10);
    if (isNaN(projectId) || projectId <= 0 || isNaN(milestoneId) || milestoneId <= 0) {
      return errorResponse(res, 'Invalid project or milestone ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify milestone belongs to project
    const milestone = await projectService.getActiveMilestone(milestoneId, projectId);

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
