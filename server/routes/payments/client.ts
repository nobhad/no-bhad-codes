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
import { autoPayService } from '../../services/auto-pay-service.js';
import { isStripeConfigured } from '../../services/integrations/stripe-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
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

// ============================================
// Saved Payment Methods
// ============================================

/**
 * GET /api/payments/methods
 * List saved payment methods for the current client.
 */
router.get(
  '/methods',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const methods = await autoPayService.listPaymentMethods(req.user!.id);
    sendSuccess(res, { methods });
  })
);

/**
 * POST /api/payments/methods/setup-intent
 * Create a SetupIntent so the client can save a new payment method.
 */
router.post(
  '/methods/setup-intent',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    if (!isStripeConfigured()) {
      errorResponse(res, 'Stripe is not configured', 400, ErrorCodes.STRIPE_NOT_CONFIGURED);
      return;
    }

    const result = await autoPayService.createSetupIntent(req.user!.id);
    sendCreated(res, result, 'Setup intent created');
  })
);

/**
 * POST /api/payments/methods
 * Save a payment method after successful SetupIntent confirmation.
 * Body: { stripePaymentMethodId: string }
 */
router.post(
  '/methods',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const { stripePaymentMethodId } = req.body;

    if (!stripePaymentMethodId) {
      errorResponse(res, 'stripePaymentMethodId is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const method = await autoPayService.savePaymentMethod(req.user!.id, stripePaymentMethodId);
    sendCreated(res, { method }, 'Payment method saved');
  })
);

/**
 * PUT /api/payments/methods/:id/default
 * Set a payment method as default.
 */
router.put(
  '/methods/:id/default',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const methodId = Number(req.params.id);
    await autoPayService.setDefaultPaymentMethod(req.user!.id, methodId);
    sendSuccess(res, undefined, 'Default payment method updated');
  })
);

/**
 * DELETE /api/payments/methods/:id
 * Remove a saved payment method.
 */
router.delete(
  '/methods/:id',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const methodId = Number(req.params.id);
    await autoPayService.removePaymentMethod(req.user!.id, methodId);
    sendSuccess(res, undefined, 'Payment method removed');
  })
);

// ============================================
// Auto-Pay
// ============================================

/**
 * GET /api/payments/auto-pay
 * Get auto-pay status for the current client.
 */
router.get(
  '/auto-pay',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const status = await autoPayService.getAutoPayStatus(req.user!.id);
    sendSuccess(res, status);
  })
);

/**
 * PUT /api/payments/auto-pay
 * Enable or disable auto-pay.
 * Body: { enabled: boolean }
 */
router.put(
  '/auto-pay',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      errorResponse(res, 'enabled (boolean) is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    // Require at least one saved payment method to enable
    if (enabled) {
      const status = await autoPayService.getAutoPayStatus(req.user!.id);
      if (status.methodCount === 0) {
        errorResponse(res, 'Please add a payment method before enabling auto-pay', 400, ErrorCodes.VALIDATION_ERROR);
        return;
      }
    }

    await autoPayService.setAutoPay(req.user!.id, enabled);
    sendSuccess(res, { enabled }, `Auto-pay ${enabled ? 'enabled' : 'disabled'}`);
  })
);

export default router;
