/**
 * ===============================================
 * PAYMENT WEBHOOK ROUTES
 * ===============================================
 * @file server/routes/payments/webhook.ts
 *
 * Stripe webhook handler for PaymentIntent events (embedded flow).
 * Uses raw body + signature verification — no JWT auth.
 */

import { Router, Response } from 'express';
import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  verifyWebhookSignature,
  claimStripeEvent,
  releaseStripeEventClaim
} from '../../services/integrations/stripe-service.js';
import { stripePaymentService } from '../../services/stripe-payment-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { logger } from '../../services/logger.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * POST /api/payments/webhook
 * Stripe webhook for PaymentIntent events.
 * No JWT auth — uses Stripe signature verification.
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      errorResponse(res, 'Missing Stripe signature', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const rawBody =
      req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      errorResponse(res, 'Invalid webhook signature', 401, ErrorCodes.UNAUTHORIZED);
      return;
    }

    const event = req.body instanceof Buffer ? JSON.parse(rawBody) : req.body;
    const eventId = (event as { id?: string }).id;
    const eventType = (event as { type?: string }).type;
    const dataObject = (event as { data?: { object?: Record<string, unknown> } }).data?.object;

    if (!eventId || !eventType || !dataObject) {
      errorResponse(res, 'Invalid webhook event structure', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    // Stripe retries on non-2xx responses and can deliver duplicates even
    // on success. Skip events we've already handled, but return 200 so
    // Stripe stops retrying.
    const fresh = await claimStripeEvent(eventId);
    if (!fresh) {
      logger.info(`[Webhook] Stripe event ${eventId} already processed, skipping`);
      sendSuccess(res, { received: true, alreadyProcessed: true });
      return;
    }

    const intentId = dataObject.id as string;

    try {
      switch (eventType) {
      case 'payment_intent.succeeded':
        await stripePaymentService.handlePaymentSuccess(intentId);
        break;

      case 'payment_intent.payment_failed': {
        const failureMessage =
            (dataObject.last_payment_error as { message?: string } | undefined)?.message || 'Payment failed';
        await stripePaymentService.handlePaymentFailure(intentId, failureMessage);
        break;
      }

      default:
        logger.info(`Unhandled payment webhook event: ${eventType}`);
      }
    } catch (err) {
      // Release the claim so Stripe's retry can reprocess the event
      // instead of hitting the idempotency short-circuit next time.
      await releaseStripeEventClaim(eventId);
      throw err;
    }

    sendSuccess(res, { received: true });
  })
);

export default router;
