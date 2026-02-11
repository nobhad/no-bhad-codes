import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessFile, canAccessFileComment } from '../../middleware/access-control.js';
import { fileService } from '../../services/file-service.js';
import { errorResponse } from '../../utils/api-response.js';

const router = express.Router();

// Get comments for a file
router.get(
  '/files/:fileId/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const includeInternal = req.user!.type === 'admin';
    const comments = await fileService.getComments(fileId, includeInternal);
    res.json({ comments });
  })
);

// Add comment to a file
router.post(
  '/files/:fileId/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fileId = parseInt(req.params.fileId);
    const { content, is_internal, parent_comment_id, author_name } = req.body;

    if (isNaN(fileId)) {
      return errorResponse(res, 'Invalid file ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFile(req, fileId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    if (!content || content.trim().length === 0) {
      return errorResponse(res, 'Comment content is required', 400, 'MISSING_CONTENT');
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

    res.status(201).json({ comment });
  })
);

// Delete a comment
router.delete(
  '/files/comments/:commentId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const commentId = parseInt(req.params.commentId);
    if (isNaN(commentId)) {
      return errorResponse(res, 'Invalid comment ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessFileComment(req, commentId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    await fileService.deleteComment(commentId);
    res.json({ message: 'Comment deleted' });
  })
);

export { router as fileCommentsRouter };
export default router;
