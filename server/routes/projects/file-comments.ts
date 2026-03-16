import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessFile, canAccessFileComment } from '../../utils/access-control.js';
import { fileService } from '../../services/file-service.js';
import { errorResponse, sendSuccess, sendCreated, messageResponse, ErrorCodes } from '../../utils/api-response.js';
import { invalidateCache } from '../../middleware/cache.js';

const router = express.Router();

// Get comments for a file
router.get(
  '/files/:fileId/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const includeInternal = req.user!.type === 'admin';
    const comments = await fileService.getComments(fileId, includeInternal);
    sendSuccess(res, { comments });
  })
);

// Add comment to a file
router.post(
  '/files/:fileId/comments',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId, 10);
    const { content, is_internal, parent_comment_id, author_name } = req.body;

    if (isNaN(fileId) || fileId <= 0) {
      return errorResponse(res, 'Invalid file ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    if (!content || content.trim().length === 0) {
      return errorResponse(res, 'Comment content is required', 400, ErrorCodes.MISSING_CONTENT);
    }

    const comment = await fileService.addComment(
      fileId,
      req.user!.email,
      req.user!.type as 'admin' | 'client',
      content.trim(),
      author_name || req.user!.email,
      is_internal && req.user!.type === 'admin',
      parent_comment_id
    );

    sendCreated(res, { comment });
  })
);

// Delete a comment
router.delete(
  '/files/comments/:commentId',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return errorResponse(res, 'Invalid comment ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessFileComment(req, commentId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    await fileService.deleteComment(commentId);
    messageResponse(res, 'Comment deleted');
  })
);

export { router as fileCommentsRouter };
export default router;
