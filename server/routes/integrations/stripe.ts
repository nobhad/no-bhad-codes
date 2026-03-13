/**
 * Stripe payment routes.
 *
 * GET    /stripe/status                - Get Stripe status
 * POST   /stripe/payment-link          - Create Stripe payment link
 * GET    /stripe/payment-link/:invoiceId - Get payment link for invoice
 * DELETE /stripe/payment-link/:invoiceId - Expire payment link
 * POST   /stripe/webhook               - Stripe webhook handler (no auth, uses express.raw())
 */

import { Router } from 'express';
import express, { Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  isStripeConfigured,
  createPaymentLink,
  getPaymentLink,
  expirePaymentLink,
  getStripeStatus,
  verifyWebhookSignature,
  handleWebhookEvent
} from '../../services/integrations/index.js';
import { getDatabase } from '../../database/init.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { INVOICE_COLUMNS } from './shared.js';

const router = Router();

/**
 * @swagger
 * /api/integrations/stripe/status:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get Stripe status
 *     description: Retrieve Stripe configuration and connection status. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Stripe configuration status
 */
router.get(
  '/stripe/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const status = getStripeStatus();
    sendSuccess(res, status);
  })
);

/**
 * @swagger
 * /api/integrations/stripe/payment-link:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Create Stripe payment link
 *     description: Create a payment link for an invoice via Stripe. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoiceId
 *             properties:
 *               invoiceId:
 *                 type: integer
 *               successUrl:
 *                 type: string
 *               cancelUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment link created
 *       400:
 *         description: Stripe not configured or validation error
 *       404:
 *         description: Invoice not found
 */
router.post(
  '/stripe/payment-link',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!isStripeConfigured()) {
      errorResponse(
        res,
        'Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.',
        400,
        ErrorCodes.STRIPE_NOT_CONFIGURED
      );
      return;
    }

    const { invoiceId, successUrl, cancelUrl } = req.body;

    if (!invoiceId) {
      errorResponse(res, 'Invoice ID is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const db = getDatabase();
    const invoice = await db.get(`SELECT ${INVOICE_COLUMNS} FROM invoices WHERE id = ?`, [invoiceId]);

    if (!invoice) {
      errorResponse(res, 'Invoice not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    const invoiceData = invoice as { total_amount: number; invoice_number: string };
    const paymentLink = await createPaymentLink({
      invoiceId,
      amount: Math.round(invoiceData.total_amount * 100), // Convert to cents
      description: `Invoice #${invoiceData.invoice_number}`,
      successUrl,
      cancelUrl
    });

    sendCreated(res, { paymentLink });
  })
);

/**
 * @swagger
 * /api/integrations/stripe/payment-link/{invoiceId}:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get payment link for invoice
 *     description: Retrieve an existing Stripe payment link for an invoice. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment link details
 *       404:
 *         description: No active payment link found
 */
router.get(
  '/stripe/payment-link/:invoiceId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { invoiceId } = req.params;
    const link = await getPaymentLink(parseInt(invoiceId, 10));

    if (!link) {
      errorResponse(res, 'No active payment link found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    sendSuccess(res, { paymentLink: link });
  })
);

/**
 * @swagger
 * /api/integrations/stripe/payment-link/{invoiceId}:
 *   delete:
 *     tags:
 *       - Integrations
 *     summary: Expire payment link
 *     description: Expire or cancel a Stripe payment link for an invoice. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment link expired
 */
router.delete(
  '/stripe/payment-link/:invoiceId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { invoiceId } = req.params;
    await expirePaymentLink(parseInt(invoiceId, 10));
    sendSuccess(res, undefined, 'Payment link expired');
  })
);

/**
 * @swagger
 * /api/integrations/stripe/webhook:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Stripe webhook handler
 *     description: Handle incoming Stripe webhook events. Uses Stripe signature verification instead of JWT auth.
 *     parameters:
 *       - in: header
 *         name: stripe-signature
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook processed
 *       400:
 *         description: Missing signature
 *       401:
 *         description: Invalid signature
 */
router.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      errorResponse(res, 'Missing Stripe signature', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    // Get raw body for signature verification - req.body is a Buffer from express.raw()
    const rawBody =
      req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      errorResponse(res, 'Invalid Stripe webhook signature', 401, ErrorCodes.UNAUTHORIZED);
      return;
    }

    // Parse the JSON body now that signature is verified
    const event = req.body instanceof Buffer ? JSON.parse(rawBody) : req.body;

    await handleWebhookEvent(event);
    sendSuccess(res, { received: true });
  })
);

export default router;
