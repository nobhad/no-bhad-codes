/**
 * ===============================================
 * CLIENT PAYMENT ROUTES
 * ===============================================
 * @file server/routes/payments/client.ts
 *
 * Endpoints for embedded Stripe Elements payment flow (client-facing).
 *
 * POST /create-intent  — Create a PaymentIntent for an invoice or installment
 */

import { Router, Response } from 'express';
import { authenticateToken, requireClient } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { stripePaymentService } from '../../services/stripe-payment-service.js';
import { isStripeConfigured } from '../../services/integrations/stripe-service.js';
import { errorResponse, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * POST /api/payments/create-intent
 * Create a Stripe PaymentIntent for an invoice or installment.
 * Requires client authentication.
 */
router.post(
  '/create-intent',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    if (!isStripeConfigured()) {
      errorResponse(res, 'Stripe is not configured', 400, ErrorCodes.STRIPE_NOT_CONFIGURED);
      return;
    }

    const clientId = req.user!.id;
    const { invoiceId, installmentId } = req.body;

    if (!invoiceId && !installmentId) {
      errorResponse(res, 'Either invoiceId or installmentId is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const result = await stripePaymentService.createPaymentIntent({
      clientId,
      invoiceId: invoiceId ? Number(invoiceId) : undefined,
      installmentId: installmentId ? Number(installmentId) : undefined
    });

    sendCreated(res, result, 'Payment intent created');
  })
);

export default router;
