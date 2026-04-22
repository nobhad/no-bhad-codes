/**
 * ===============================================
 * PROPOSAL E-SIGNATURE ROUTES
 * ===============================================
 * @file server/routes/proposals/signing.ts
 *
 * E-signature flow endpoints for proposals.
 */

import express, { Request, Response } from 'express';
import {
  asyncHandler,
  authenticateToken,
  requireAdmin,
  canAccessProposal,
  proposalService,
  signatureRateLimiter,
  ErrorCodes,
  errorResponse,
  sendSuccess,
  sendCreated,
  SignatureAuthorizationError
} from './helpers.js';
import { invalidateCache } from '../../middleware/cache.js';
import type { AuthenticatedRequest, SignatureAuthorizationReason } from './helpers.js';

const SIGNATURE_TOKEN_REGEX = /^[a-f0-9]{32,64}$/i;

function mapSignatureAuthError(
  reason: SignatureAuthorizationReason
): { status: number; code: string } {
  switch (reason) {
    case 'EXPIRED':
      return { status: 410, code: ErrorCodes.SIGNATURE_EXPIRED };
    case 'ALREADY_SIGNED':
      return { status: 400, code: ErrorCodes.ALREADY_SIGNED };
    case 'DECLINED':
      return { status: 400, code: ErrorCodes.SIGNATURE_DECLINED };
    case 'EMAIL_MISMATCH':
      return { status: 403, code: ErrorCodes.UNAUTHORIZED };
    case 'NOT_FOUND':
    default:
      return { status: 404, code: ErrorCodes.RESOURCE_NOT_FOUND };
  }
}

const router = express.Router();

// ===================================
// E-SIGNATURE ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/signatures:
 *   get:
 *     tags: [Proposals]
 *     summary: Get all signatures for a proposal
 *     description: Get all signatures for a proposal.
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
  '/:id/signatures',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Authorization check for non-admin users
    if (req.user?.type !== 'admin' && !(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const signatures = await proposalService.getProposalSignatures(proposalId);
    sendSuccess(res, { signatures });
  })
);

/**
 * @swagger
 * /api/proposals/{id}/request-signature:
 *   post:
 *     tags: [Proposals]
 *     summary: Request a signature
 *     description: Request a signature.
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
 *         description: Created successfully
 */
router.post(
  '/:id/request-signature',
  authenticateToken,
  requireAdmin,
  invalidateCache(['proposals']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { signerEmail, signerName, expiresInDays } = req.body;
    if (!signerEmail) {
      return errorResponse(res, 'signerEmail is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const request = await proposalService.requestSignature(
      proposalId,
      signerEmail,
      signerName,
      expiresInDays
    );
    sendCreated(res, { request }, 'Signature requested successfully');
  })
);

/**
 * @swagger
 * /api/proposals/{id}/sign:
 *   post:
 *     tags: [Proposals]
 *     summary: Record a signature (public endpoint with rate limiting)
 *     description: Record a signature (public endpoint with rate limiting).
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
 *         description: Created successfully
 */
async function handleTokenSign(
  token: string,
  proposalId: number | null,
  req: Request,
  res: Response
): Promise<void> {
  if (!SIGNATURE_TOKEN_REGEX.test(token)) {
    errorResponse(res, 'Invalid signature request', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    return;
  }

  const signatureData = req.body ?? {};
  if (
    !signatureData.signerName ||
    !signatureData.signerEmail ||
    !signatureData.signatureData ||
    !signatureData.signatureMethod
  ) {
    errorResponse(
      res,
      'signerName, signerEmail, signatureMethod, and signatureData are required',
      400,
      ErrorCodes.VALIDATION_ERROR
    );
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(signatureData.signerEmail)) {
    errorResponse(res, 'Invalid email format', 400, ErrorCodes.VALIDATION_ERROR);
    return;
  }

  signatureData.ipAddress = req.ip;
  const userAgent = req.get('User-Agent') || '';
  signatureData.userAgent = userAgent.substring(0, 500);

  try {
    const signature = await proposalService.recordSignatureByToken(token, signatureData);

    if (proposalId !== null && signature.proposalId !== proposalId) {
      errorResponse(
        res,
        'Signature request does not match proposal',
        403,
        ErrorCodes.UNAUTHORIZED
      );
      return;
    }

    sendCreated(res, { signature }, 'Proposal signed successfully');
  } catch (err) {
    if (err instanceof SignatureAuthorizationError) {
      const { status, code } = mapSignatureAuthError(err.reason);
      errorResponse(res, err.message, status, code);
      return;
    }
    throw err;
  }
}

router.post(
  '/:id/sign',
  signatureRateLimiter,
  invalidateCache(['proposals']),
  asyncHandler(async (req: Request, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const token = typeof req.body?.token === 'string' ? req.body.token : null;
    if (!token) {
      return errorResponse(
        res,
        'A valid signature request token is required',
        401,
        ErrorCodes.UNAUTHORIZED
      );
    }

    await handleTokenSign(token, proposalId, req, res);
  })
);

router.post(
  '/sign/:token',
  signatureRateLimiter,
  invalidateCache(['proposals']),
  asyncHandler(async (req: Request, res: Response) => {
    await handleTokenSign(req.params.token, null, req, res);
  })
);

/**
 * @swagger
 * /api/proposals/{id}/signature-status:
 *   get:
 *     tags: [Proposals]
 *     summary: Get signature status
 *     description: Get signature status.
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
  '/:id/signature-status',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Authorization check for non-admin users
    if (req.user?.type !== 'admin' && !(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const status = await proposalService.getSignatureStatus(proposalId);
    sendSuccess(res, status);
  })
);

/**
 * @swagger
 * /api/proposals/sign/{token}:
 *   get:
 *     tags: [Proposals]
 *     summary: Get signature by token (public with rate limiting)
 *     description: Get signature by token (public with rate limiting).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/sign/:token',
  signatureRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    // Validate token format (should be a valid hex string)
    if (!token || !/^[a-f0-9]{32,64}$/i.test(token)) {
      return errorResponse(res, 'Invalid signature request', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const request = await proposalService.getSignatureRequestByToken(token);
    if (!request) {
      return errorResponse(res, 'Invalid or expired signature request', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Check if token has expired
    if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
      return errorResponse(res, 'Signature request has expired', 410, ErrorCodes.SIGNATURE_EXPIRED);
    }

    // Check if already signed or declined
    if (request.status === 'signed') {
      return errorResponse(res, 'This proposal has already been signed', 400, ErrorCodes.ALREADY_SIGNED);
    }
    if (request.status === 'declined') {
      return errorResponse(res, 'This signature request was declined', 400, ErrorCodes.SIGNATURE_DECLINED);
    }

    // Mark as viewed
    await proposalService.markSignatureViewed(token);
    sendSuccess(res, { request });
  })
);

/**
 * @swagger
 * /api/proposals/sign/{token}/decline:
 *   post:
 *     tags: [Proposals]
 *     summary: Decline signature (public with rate limiting)
 *     description: Decline signature (public with rate limiting).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/sign/:token/decline',
  signatureRateLimiter,
  invalidateCache(['proposals']),
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    // Validate token format
    if (!token || !/^[a-f0-9]{32,64}$/i.test(token)) {
      return errorResponse(res, 'Invalid signature request', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { reason } = req.body;

    // Validate reason length if provided
    if (reason && typeof reason === 'string' && reason.length > 2000) {
      return errorResponse(res, 'Reason is too long (max 2000 characters)', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await proposalService.declineSignature(token, reason);
    sendSuccess(res, undefined, 'Signature declined');
  })
);

export { router as signingRouter };
