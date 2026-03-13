/**
 * ===============================================
 * UPLOAD ROUTES — DELIVERABLE WORKFLOW
 * ===============================================
 * Endpoints for the deliverable review workflow:
 * submit, start-review, request-changes, approve,
 * reject, resubmit, and comments.
 */

import express, { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { validateRequest } from '../../middleware/validation.js';
import {
  errorResponse,
  sendSuccess,
  sendCreated,
  ErrorCodes
} from '../../utils/api-response.js';
import { fileService } from '../../services/file-service.js';
import {
  UploadValidationSchemas,
  canAccessProject,
  canAccessFile
} from './shared.js';

const router = Router();

router.get(
  '/deliverables/project/:projectId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId, 10);
    const status = req.query.status as string | undefined;

    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_PROJECT_ID);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const deliverables = await fileService.getProjectDeliverables(projectId, status);
    const stats = await fileService.getDeliverableStats(projectId);

    sendSuccess(res, { deliverables, stats });
  })
);

router.get(
  '/deliverables/pending',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user?.type !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, ErrorCodes.ACCESS_DENIED);
    }

    const deliverables = await fileService.getPendingReviewDeliverables();
    sendSuccess(res, { deliverables });
  })
);

router.get(
  '/deliverables/:fileId/workflow',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId, 10);

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const workflow = await fileService.getDeliverableWorkflow(fileId);
    const comments = await fileService.getReviewComments(fileId);
    const history = await fileService.getDeliverableHistory(fileId);

    sendSuccess(res, { workflow, comments, history });
  })
);

router.post(
  '/deliverables/:fileId/submit',
  authenticateToken,
  validateRequest({ notes: UploadValidationSchemas.deliverableAction.notes }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const { notes } = req.body;

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const submittedBy = req.user?.email || 'unknown';
    const workflow = await fileService.submitForReview(fileId, submittedBy, notes);

    sendSuccess(res, { workflow }, 'Deliverable submitted for review');
  })
);

router.post(
  '/deliverables/:fileId/start-review',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user?.type !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, ErrorCodes.ACCESS_DENIED);
    }

    const fileId = parseInt(req.params.fileId, 10);

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    const reviewerEmail = req.user?.email || 'admin';
    const workflow = await fileService.startReview(fileId, reviewerEmail);

    sendSuccess(res, { workflow }, 'Review started');
  })
);

router.post(
  '/deliverables/:fileId/request-changes',
  authenticateToken,
  validateRequest({
    feedback: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: 5000 }
    ]
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user?.type !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, ErrorCodes.ACCESS_DENIED);
    }

    const fileId = parseInt(req.params.fileId, 10);
    const { feedback } = req.body;

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    if (!feedback) {
      return errorResponse(
        res,
        'Feedback is required when requesting changes',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const reviewerEmail = req.user?.email || 'admin';
    const workflow = await fileService.requestChanges(fileId, reviewerEmail, feedback);

    sendSuccess(res, { workflow }, 'Changes requested');
  })
);

router.post(
  '/deliverables/:fileId/approve',
  authenticateToken,
  validateRequest({ comment: UploadValidationSchemas.deliverableAction.comment }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user?.type !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, ErrorCodes.ACCESS_DENIED);
    }

    const fileId = parseInt(req.params.fileId, 10);
    const { comment } = req.body;

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    const approverEmail = req.user?.email || 'admin';
    const workflow = await fileService.approveDeliverable(fileId, approverEmail, comment);

    sendSuccess(res, { workflow }, 'Deliverable approved');
  })
);

router.post(
  '/deliverables/:fileId/reject',
  authenticateToken,
  validateRequest({
    reason: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: 2000 }
    ]
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user?.type !== 'admin') {
      return errorResponse(res, 'Admin access required', 403, ErrorCodes.ACCESS_DENIED);
    }

    const fileId = parseInt(req.params.fileId, 10);
    const { reason } = req.body;

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    if (!reason) {
      return errorResponse(res, 'Reason is required when rejecting', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const reviewerEmail = req.user?.email || 'admin';
    const workflow = await fileService.rejectDeliverable(fileId, reviewerEmail, reason);

    sendSuccess(res, { workflow }, 'Deliverable rejected');
  })
);

router.post(
  '/deliverables/:fileId/resubmit',
  authenticateToken,
  validateRequest({ notes: UploadValidationSchemas.deliverableAction.notes }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const { notes } = req.body;

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    const submittedBy = req.user?.email || 'unknown';
    const workflow = await fileService.resubmitDeliverable(fileId, submittedBy, notes);

    sendSuccess(res, { workflow }, 'Deliverable resubmitted for review');
  })
);

router.post(
  '/deliverables/:fileId/comments',
  authenticateToken,
  validateRequest({
    comment: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: 2000 }
    ]
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const { comment } = req.body;

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_FILE_ID);
    }

    if (!comment) {
      return errorResponse(res, 'Comment is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const workflow = await fileService.getDeliverableWorkflow(fileId);
    if (!workflow) {
      return errorResponse(res, 'Deliverable workflow not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const authorEmail = req.user?.email || 'unknown';
    const authorType = req.user?.type === 'admin' ? 'admin' : 'client';
    const newComment = await fileService.addReviewComment(
      workflow.id,
      authorEmail,
      authorType as 'admin' | 'client',
      comment,
      'feedback'
    );

    sendCreated(res, { comment: newComment }, 'Comment added');
  })
);

export default router;
