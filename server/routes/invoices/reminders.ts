/**
 * ===============================================
 * INVOICE REMINDER ROUTES
 * ===============================================
 * @file server/routes/invoices/reminders.ts
 *
 * Reminder endpoints for invoices.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';
import { emailService } from '../../services/email-service.js';
import { getDatabase } from '../../database/init.js';
import { BUSINESS_INFO } from '../../config/business.js';
import { getInvoiceService, toSnakeCaseReminder } from './helpers.js';

const router = express.Router();

/**
 * @swagger
 * /api/invoices/{id}/reminders:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get reminders for an invoice
 */
router.get(
  '/:id/reminders',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const reminders = await getInvoiceService().getInvoiceReminders(invoiceId);

      res.json({
        success: true,
        reminders: reminders.map(toSnakeCaseReminder),
        count: reminders.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve reminders', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/reminders/{id}/skip:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Skip a scheduled reminder
 */
router.post(
  '/reminders/:id/skip',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const reminderId = parseInt(req.params.id);

    if (isNaN(reminderId)) {
      return errorResponse(res, 'Invalid reminder ID', 400, 'INVALID_ID');
    }

    try {
      await getInvoiceService().skipReminder(reminderId);

      res.json({
        success: true,
        message: 'Reminder skipped'
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to skip reminder', 500, 'SKIP_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/send-reminder:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Send a payment reminder email
 *     description: Manually send a payment reminder for an outstanding invoice
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
 *         description: Reminder sent successfully
 *       400:
 *         description: Invoice is already paid
 */
router.post(
  '/:id/send-reminder',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);

      if (invoice.status === 'paid') {
        return errorResponse(res, 'Cannot send reminder for a paid invoice', 400, 'INVOICE_PAID');
      }

      if (invoice.status === 'cancelled') {
        return errorResponse(res, 'Cannot send reminder for a cancelled invoice', 400, 'INVOICE_CANCELLED');
      }

      // Get client email
      const db = getDatabase();
      const clientRow = await db.get(
        'SELECT email, contact_name FROM clients WHERE id = ?',
        [invoice.clientId]
      ) as { email?: string; contact_name?: string } | undefined;

      if (!clientRow || !clientRow.email) {
        return errorResponse(res, 'Client email not found', 400, 'NO_CLIENT_EMAIL');
      }

      const clientEmail = clientRow.email;
      const clientName = clientRow.contact_name || 'Valued Client';

      // Determine reminder urgency
      const today = new Date();
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const daysOverdue = dueDate ? Math.ceil((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;

      let subject: string;
      let urgencyMessage = '';

      if (daysOverdue > 14) {
        subject = `URGENT: Invoice #${invoice.invoiceNumber} is ${daysOverdue} days overdue`;
        urgencyMessage = 'Immediate payment is required.';
      } else if (daysOverdue > 0) {
        subject = `Payment Overdue: Invoice #${invoice.invoiceNumber}`;
        urgencyMessage = `This invoice is ${daysOverdue} day(s) overdue.`;
      } else {
        subject = `Payment Reminder: Invoice #${invoice.invoiceNumber}`;
        urgencyMessage = dueDate
          ? `Payment is due on ${dueDate.toLocaleDateString()}.`
          : 'Payment is due upon receipt.';
      }

      const outstandingAmount = invoice.amountTotal - (invoice.amountPaid || 0);
      const portalUrl = `${process.env.CLIENT_PORTAL_URL || 'http://localhost:3000/client/portal'}?invoice=${invoiceId}`;

      await emailService.sendEmail({
        to: clientEmail,
        subject,
        text: `
Hi ${clientName},

This is a reminder regarding invoice #${invoice.invoiceNumber}.

Amount Outstanding: $${outstandingAmount.toFixed(2)}
${urgencyMessage}

View and pay your invoice here: ${portalUrl}

If you have already submitted payment, please disregard this message.

Best regards,
${BUSINESS_INFO.name}
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${daysOverdue > 0 ? '#dc3545' : '#00ff41'}; color: ${daysOverdue > 0 ? '#fff' : '#000'}; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .amount { font-size: 24px; font-weight: bold; color: #333; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #00ff41; color: #000; text-decoration: none; border-radius: 4px; }
    .urgency { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
    .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${subject}</h2>
    </div>
    <div class="content">
      <p>Hi ${clientName},</p>
      <p>This is a reminder regarding invoice #${invoice.invoiceNumber}.</p>
      ${urgencyMessage ? `<div class="urgency"><strong>${urgencyMessage}</strong></div>` : ''}
      <div class="amount">Amount Outstanding: $${outstandingAmount.toFixed(2)}</div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}" class="button">View Invoice & Pay</a>
      </p>
      <p><small>If you have already submitted payment, please disregard this message.</small></p>
    </div>
    <div class="footer">
      <p>Best regards,<br>${BUSINESS_INFO.name}</p>
    </div>
  </div>
</body>
</html>
        `
      });

      res.json({
        success: true,
        message: 'Payment reminder sent successfully',
        sentTo: clientEmail
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to send reminder', 500, 'SEND_REMINDER_FAILED', { message });
    }
  })
);

export { router as remindersRouter };
export default router;
