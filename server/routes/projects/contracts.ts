import express, { Response } from 'express';
import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { PDFDocument as PDFLibDocument, StandardFonts, degrees, rgb, PDFPage } from 'pdf-lib';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject } from '../../middleware/access-control.js';
import { getUploadsDir, getUploadsSubdir, getRelativePath, UPLOAD_DIRS, sanitizeFilename } from '../../config/uploads.js';
import { getString, getNumber } from '../../database/row-helpers.js';
import { getSchedulerService } from '../../services/scheduler-service.js';
import { BUSINESS_INFO, getPdfLogoBytes, CONTRACT_TERMS } from '../../config/business.js';
import {
  getPdfCacheKey,
  getCachedPdf,
  cachePdf,
  ensureSpace,
  drawWrappedText,
  addPageNumbers,
  PAGE_MARGINS
} from '../../utils/pdf-utils.js';
import { errorResponse } from '../../utils/api-response.js';
import { sendPdfResponse } from '../../utils/pdf-generator.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import { logger } from '../../services/logger.js';

const router = express.Router();

/**
 * GET /api/projects/:id/contract/pdf
 * Generate PDF contract for a project
 */
router.get(
  '/:id/contract/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Get project with client info
    const project = await db.get(
      `SELECT p.*, c.contact_name as client_name, c.email as client_email,
              c.company_name, c.phone as client_phone, c.address as client_address
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );

    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    // Cast project for helper functions
    const p = project as Record<string, unknown>;

    // Load latest contract draft (if any) for content and cache invalidation
    const contractRow = await db.get(
      `SELECT * FROM contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    const contract = contractRow as Record<string, unknown> | undefined;
    const contractContent = contract ? getString(contract, 'content') : '';
    const contractStatus = contract ? getString(contract, 'status') : '';
    const contractUpdatedAt = contract ? getString(contract, 'updated_at') : undefined;

    const signedPdfPath = getString(p, 'contract_signed_pdf_path');
    if (signedPdfPath) {
      const cleanPath = signedPdfPath.replace(/^\//, '').replace(/^uploads\//, '');
      const absolutePath = path.resolve(getUploadsDir(), cleanPath);
      if (existsSync(absolutePath)) {
        const pdfBytes = readFileSync(absolutePath);
        const projectName = getString(project, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');
        return sendPdfResponse(res, pdfBytes, {
          filename: `contract-${projectName}-${projectId}.pdf`,
          cacheStatus: 'SIGNED'
        });
      }
    }

    // Check cache first
    const cacheKey = getPdfCacheKey('contract', projectId, contractUpdatedAt || getString(project, 'updated_at'));
    const cachedPdf = getCachedPdf(cacheKey);
    if (cachedPdf) {
      const projectName = getString(project, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');
      return sendPdfResponse(res, cachedPdf, {
        filename: `contract-${projectName}-${projectId}.pdf`,
        cacheStatus: 'HIT'
      });
    }

    // Helper function to format date
    const formatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Create PDF document using pdf-lib
    const pdfDoc = await PDFLibDocument.create();
    pdfDoc.setTitle(`Contract - ${getString(p, 'project_name')}`);
    pdfDoc.setAuthor(BUSINESS_INFO.name);

    const page = pdfDoc.addPage([612, 792]); // LETTER size
    const { width, height } = page.getSize();

    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Layout constants (0.75 inch margins per template)
    const leftMargin = 54;
    const rightMargin = width - 54;
    const contentWidth = rightMargin - leftMargin;

    // Start from top - template uses 0.6 inch from top
    let y = height - 43;

    const isSigned = Boolean(getString(p, 'contract_signed_at') || (contract?.signed_at as string | undefined));
    const shouldWatermark = !isSigned;

    const drawDraftWatermark = (targetPage: PDFPage): void => {
      if (!shouldWatermark) return;
      const label = contractStatus === 'draft' || !contractStatus ? 'DRAFT' : 'UNSIGNED';
      const fontSize = 72;
      const textWidth = helveticaBold.widthOfTextAtSize(label, fontSize);
      targetPage.drawText(label, {
        x: (width - textWidth) / 2,
        y: height / 2,
        size: fontSize,
        font: helveticaBold,
        color: rgb(0.88, 0.88, 0.88),
        rotate: degrees(-20)
      });
    };

    const parseSignatureData = (data?: string): Uint8Array | null => {
      if (!data) return null;
      const match = data.match(/^data:image\/png;base64,(.+)$/);
      if (!match) return null;
      return Uint8Array.from(Buffer.from(match[1], 'base64'));
    };

    drawDraftWatermark(page);

    // === HEADER - Title on left, logo and business info on right ===
    const logoHeight = 100; // ~1.4 inch for prominent branding

    // CONTRACT title on left: 28pt
    const titleText = 'CONTRACT';
    page.drawText(titleText, {
      x: leftMargin, y: y - 20, size: 28, font: helveticaBold, color: rgb(0.15, 0.15, 0.15)
    });

    // Logo and business info on right (logo left of text, text left-aligned)
    let textStartX = rightMargin - 180;
    const logoBytes = getPdfLogoBytes();
    if (logoBytes) {
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
      const logoX = rightMargin - logoWidth - 150;
      page.drawImage(logoImage, {
        x: logoX,
        y: y - logoHeight + 10,
        width: logoWidth,
        height: logoHeight
      });
      textStartX = logoX + logoWidth + 18;
    }

    // Business info (left-aligned, to right of logo)
    page.drawText(BUSINESS_INFO.name, { x: textStartX, y: y - 11, size: 15, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(BUSINESS_INFO.owner, { x: textStartX, y: y - 34, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(BUSINESS_INFO.tagline, { x: textStartX, y: y - 54, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(BUSINESS_INFO.email, { x: textStartX, y: y - 70, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(BUSINESS_INFO.website, { x: textStartX, y: y - 86, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    y -= 120; // Account for 100pt logo height

    // Divider line
    page.drawLine({
      start: { x: leftMargin, y: y },
      end: { x: rightMargin, y: y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7)
    });
    y -= 21;

    // === CONTRACT INFO - Two columns ===
    const rightCol = width / 2 + 36;

    // Left side - Client Info
    page.drawText('Client:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(getString(p, 'client_name') || 'Client', { x: leftMargin, y: y - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    let clientLineY = y - 30;
    if (p.company_name) {
      page.drawText(String(p.company_name), { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      clientLineY -= 15;
    }
    page.drawText(getString(p, 'client_email') || '', { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });

    // Right side - Service Provider
    page.drawText('Service Provider:', { x: rightCol, y: y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(BUSINESS_INFO.name, { x: rightCol, y: y - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    page.drawText('Contract Date:', { x: rightCol, y: y - 45, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(formatDate(getString(p, 'contract_signed_at') || getString(p, 'created_at')), { x: rightCol, y: y - 60, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    y -= 90;

    const formatCurrency = (value?: string): string => {
      if (!value) return '';
      const numeric = Number(value);
      if (Number.isNaN(numeric)) return value;
      return numeric.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    };

    const startDate = getString(p, 'start_date');
    const dueDate = getString(p, 'due_date');
    const timeline = getString(p, 'timeline');
    const projectType = getString(p, 'project_type');
    const description = getString(p, 'description');
    const price = getString(p, 'price');
    const depositAmount = getString(p, 'deposit_amount');

    const fallbackContent = [
      'CONTRACT AGREEMENT',
      '',
      `This Agreement is made on ${formatDate(getString(p, 'contract_signed_at') || getString(p, 'created_at'))} between ${BUSINESS_INFO.name} ("Service Provider") and ${getString(p, 'client_name') || 'Client'} ("Client").`,
      '',
      '1. Project Scope',
      `Project Name: ${getString(p, 'project_name')}`,
      projectType ? `Project Type: ${projectType.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}` : '',
      description ? `Description: ${description}` : '',
      '',
      '2. Timeline',
      startDate ? `Start Date: ${formatDate(startDate)}` : '',
      dueDate ? `Target Completion: ${formatDate(dueDate)}` : '',
      timeline ? `Estimated Timeline: ${timeline}` : '',
      '',
      '3. Payment Terms',
      price ? `Total Project Cost: ${formatCurrency(price)}` : '',
      depositAmount ? `Deposit Amount: ${formatCurrency(depositAmount)}` : '',
      'Payment is due according to the agreed milestones. Final payment is due upon project completion and client approval.',
      '',
      '4. Terms and Conditions',
      ...CONTRACT_TERMS.map((term) => `- ${term}`),
      '',
      '5. Contact',
      `Service Provider: ${BUSINESS_INFO.name}`,
      `Email: ${BUSINESS_INFO.email}`,
      `Website: ${BUSINESS_INFO.website}`,
      '',
      `Client: ${getString(p, 'client_name') || 'Client'}`,
      `Email: ${getString(p, 'client_email') || ''}`,
      `Company: ${getString(p, 'company_name') || ''}`
    ].join('\n');

    const contentSource = contractContent && contractContent.trim() ? contractContent : fallbackContent;
    const contentLines = contentSource.replace(/\r/g, '').split('\n');

    const ctx = {
      pdfDoc,
      currentPage: page,
      pageNumber: 1,
      y,
      width,
      height,
      leftMargin,
      rightMargin,
      topMargin: PAGE_MARGINS.top,
      bottomMargin: PAGE_MARGINS.bottom,
      contentWidth,
      fonts: {
        regular: helvetica,
        bold: helveticaBold
      }
    };

    const onNewPage = (nextCtx: typeof ctx): void => {
      drawDraftWatermark(nextCtx.currentPage);
    };

    for (const rawLine of contentLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        ctx.y -= 10;
        continue;
      }

      let text = trimmed;
      let font = helvetica;
      let fontSize = 10;
      let indent = 0;

      if (/^[-*]\s+/.test(text)) {
        indent = 12;
        text = text.replace(/^[-*]\s+/, '');
      }

      const isTitle = /^[A-Z][A-Z\s]{3,}$/.test(text);
      const isSection = /^\d+\.\s+/.test(text);

      if (isTitle) {
        font = helveticaBold;
        fontSize = 14;
      } else if (isSection) {
        font = helveticaBold;
        fontSize = 12;
      }

      drawWrappedText(ctx, text, {
        x: leftMargin + indent,
        fontSize,
        font,
        maxWidth: contentWidth - indent,
        onNewPage
      });

      ctx.y -= isTitle || isSection ? 6 : 2;
    }

    // === SIGNATURES ===
    ensureSpace(ctx, 120, onNewPage);
    ctx.currentPage.drawText('Signatures', { x: leftMargin, y: ctx.y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
    ctx.y -= 22;

    const signatureWidth = 200;
    const signatureLineY = ctx.y - 30;
    const signedDate = isSigned
      ? formatDate(getString(p, 'contract_signed_at') || (contract?.signed_at as string | undefined))
      : '______________';
    const countersignedAt = getString(p, 'contract_countersigned_at') || (contract?.countersigned_at as string | undefined);
    const countersignedDate = countersignedAt ? formatDate(countersignedAt) : '______________';

    const clientSignatureData = getString(p, 'contract_signature_data') || (contract ? getString(contract, 'signature_data') : '');
    const countersignatureData = getString(p, 'contract_countersignature_data') || (contract ? getString(contract, 'countersignature_data') : '');
    const clientSignatureBytes = parseSignatureData(clientSignatureData);
    const countersignatureBytes = parseSignatureData(countersignatureData);

    const signatureImageHeight = 40;
    const signatureImageWidth = 140;

    ctx.currentPage.drawText('Client:', { x: leftMargin, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    ctx.currentPage.drawLine({ start: { x: leftMargin, y: signatureLineY }, end: { x: leftMargin + signatureWidth, y: signatureLineY }, thickness: 1, color: rgb(0, 0, 0) });
    if (clientSignatureBytes) {
      const clientSignatureImage = await pdfDoc.embedPng(clientSignatureBytes);
      ctx.currentPage.drawImage(clientSignatureImage, {
        x: leftMargin + 8,
        y: signatureLineY + 6,
        width: signatureImageWidth,
        height: signatureImageHeight
      });
    }
    ctx.currentPage.drawText(getString(p, 'client_name') || 'Client Name', { x: leftMargin, y: signatureLineY - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    ctx.currentPage.drawText(`Date: ${signedDate}`, { x: leftMargin, y: signatureLineY - 30, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    ctx.currentPage.drawText('Service Provider:', { x: rightCol, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    ctx.currentPage.drawLine({ start: { x: rightCol, y: signatureLineY }, end: { x: rightCol + signatureWidth, y: signatureLineY }, thickness: 1, color: rgb(0, 0, 0) });
    if (countersignatureBytes) {
      const countersignatureImage = await pdfDoc.embedPng(countersignatureBytes);
      ctx.currentPage.drawImage(countersignatureImage, {
        x: rightCol + 8,
        y: signatureLineY + 6,
        width: signatureImageWidth,
        height: signatureImageHeight
      });
    }
    ctx.currentPage.drawText(BUSINESS_INFO.name, { x: rightCol, y: signatureLineY - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    ctx.currentPage.drawText(`Date: ${countersignedDate}`, { x: rightCol, y: signatureLineY - 30, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    // === FOOTERS ===
    const footerTerms = 'Standard terms and conditions apply.';
    const footerContact = `Questions? Contact us at ${BUSINESS_INFO.email}`;
    for (const footerPage of pdfDoc.getPages()) {
      const { width: footerWidth } = footerPage.getSize();
      const termsWidth = helvetica.widthOfTextAtSize(footerTerms, 8);
      const contactWidth = helvetica.widthOfTextAtSize(footerContact, 9);
      footerPage.drawText(footerTerms, {
        x: (footerWidth - termsWidth) / 2,
        y: 52,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5)
      });
      footerPage.drawText(footerContact, {
        x: (footerWidth - contactWidth) / 2,
        y: 40,
        size: 9,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4)
      });
    }

    await addPageNumbers(pdfDoc, { marginBottom: 30 });

    // Generate PDF bytes and send
    const pdfBytes = await pdfDoc.save();
    const projectName = getString(p, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');

    const countersignedAtValue = getString(p, 'contract_countersigned_at') || (contract ? getString(contract, 'countersigned_at') : '');
    if (isSigned && countersignedAtValue && !signedPdfPath) {
      const contractsDir = getUploadsSubdir(UPLOAD_DIRS.CONTRACTS);
      const filename = sanitizeFilename(`contract-${projectName}-${projectId}.pdf`);
      const absolutePath = path.join(contractsDir, filename);
      writeFileSync(absolutePath, pdfBytes);
      const relativePath = getRelativePath(UPLOAD_DIRS.CONTRACTS, filename) as string;

      await db.run('UPDATE projects SET contract_signed_pdf_path = ? WHERE id = ?', [relativePath, projectId]);

      const latestContract = await db.get(
        `SELECT id FROM contracts WHERE project_id = ? AND status != 'cancelled'
         ORDER BY created_at DESC LIMIT 1`,
        [projectId]
      );

      if (latestContract) {
        await db.run('UPDATE contracts SET signed_pdf_path = ?, updated_at = datetime(\'now\') WHERE id = ?', [
          relativePath,
          (latestContract as Record<string, unknown>).id as number
        ]);
      }
    }

    // Cache the generated PDF
    cachePdf(cacheKey, pdfBytes, contractUpdatedAt || getString(p, 'updated_at'));

    sendPdfResponse(res, pdfBytes, {
      filename: `contract-${projectName}-${projectId}.pdf`,
      cacheStatus: 'MISS'
    });
  })
);

/**
 * POST /api/projects/:id/contract/request-signature
 * Request a contract signature from the client
 */
router.post(
  '/:id/contract/request-signature',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Get project with client info
    const project = await db.get(
      `SELECT p.*, c.email as client_email, COALESCE(c.contact_name, c.company_name) as client_name
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );

    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const p = project as Record<string, unknown>;
    const clientEmail = p.client_email as string | null;
    const clientName = p.client_name as string | null;
    const projectName = p.project_name as string;

    if (!clientEmail) {
      return errorResponse(res, 'No client email associated with this project', 400, 'MISSING_CLIENT_EMAIL');
    }

    // Generate a signature token for the contract
    const crypto = await import('crypto');
    const signatureToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token valid for 7 days

    // Store the signature request (dual-write: projects + contracts for rollback)
    await db.run(
      `UPDATE projects SET
        contract_signature_token = ?,
        contract_signature_requested_at = datetime('now'),
        contract_signature_expires_at = ?
       WHERE id = ?`,
      [signatureToken, expiresAt.toISOString(), projectId]
    );

    const latestContract = await db.get(
      `SELECT id FROM contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    if (latestContract) {
      // Write signature request to contracts table (Phase 3.3 normalization)
      await db.run(
        `UPDATE contracts SET
          signature_token = ?,
          signature_requested_at = datetime('now'),
          signature_expires_at = ?,
          status = 'sent',
          sent_at = datetime('now'),
          expires_at = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
        [
          signatureToken,
          expiresAt.toISOString(),
          expiresAt.toISOString(),
          (latestContract as Record<string, unknown>).id as number
        ]
      );
    }

    // Log signature request to audit log
    await db.run(
      `INSERT INTO contract_signature_log (project_id, action, actor_email, details)
       VALUES (?, 'requested', ?, ?)`,
      [projectId, req.user?.email || 'admin', JSON.stringify({ clientEmail, expiresAt: expiresAt.toISOString() })]
    );

    // Generate signature URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const signatureUrl = `${baseUrl}/sign-contract.html?token=${signatureToken}`;
    const contractPreviewUrl = `${baseUrl}/api/projects/${projectId}/contract/pdf`;

    // Send email to client
    const { emailService } = await import('../../services/email-service.js');
    const emailResult = await emailService.sendEmail({
      to: clientEmail,
      subject: `Contract Ready for Signature - ${projectName}`,
      text: `
Hi ${clientName || 'there'},

Your contract for "${projectName}" is ready for your signature.

Please review and sign the contract by clicking the link below:
${signatureUrl}

You can also preview the contract here:
${contractPreviewUrl}

This signature request expires on ${expiresAt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

If you have any questions about the contract, please don't hesitate to reach out.

Best regards,
${BUSINESS_INFO.name}
${BUSINESS_INFO.email}
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #00aff0; margin: 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
    .btn { display: inline-block; padding: 14px 28px; background: #00aff0; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 5px 10px 0; }
    .btn-outline { background: transparent; border: 2px solid #00aff0; color: #00aff0; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 14px; }
    .deadline { background: #fff3cd; padding: 10px 15px; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${BUSINESS_INFO.name}</h1>
    </div>
    <div class="content">
      <p>Hi ${clientName || 'there'},</p>
      <p>Your contract for <strong>"${projectName}"</strong> is ready for your signature.</p>
      <p>Please review and sign the contract by clicking the button below:</p>
      <p style="text-align: center; margin: 25px 0;">
        <a href="${signatureUrl}" class="btn">Sign Contract</a>
        <a href="${contractPreviewUrl}" class="btn btn-outline">Preview Contract</a>
      </p>
      <div class="deadline">
        <strong>Deadline:</strong> This signature request expires on ${expiresAt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
      </div>
      <p>If you have any questions about the contract, please don't hesitate to reach out.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>${BUSINESS_INFO.name}<br>${BUSINESS_INFO.email}</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    });

    logger.info(`[CONTRACT] Signature request sent for project ${projectId} to ${clientEmail}`);

    // Schedule contract reminders
    try {
      const scheduler = getSchedulerService();
      await scheduler.scheduleContractReminders(projectId);
    } catch (reminderError) {
      logger.error('[CONTRACT] Failed to schedule contract reminders:', { error: reminderError instanceof Error ? reminderError : undefined });
      // Continue - don't fail the request if reminder scheduling fails
    }

    res.json({
      success: true,
      message: 'Signature request sent',
      clientEmail,
      expiresAt: expiresAt.toISOString(),
      emailSent: emailResult.success
    });
  })
);

/**
 * GET /api/projects/contract/by-token/:token
 * Get contract details by signature token (PUBLIC - no auth required)
 */
router.get(
  '/contract/by-token/:token',
  asyncHandler(async (req: express.Request, res: Response) => {
    const { token } = req.params;
    const db = getDatabase();

    const project = await db.get(
      `SELECT p.id, p.project_name, p.price, p.contract_signature_expires_at,
              p.contract_signed_at, COALESCE(c.contact_name, c.company_name) as client_name, c.email as client_email
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.contract_signature_token = ?`,
      [token]
    );

    if (!project) {
      return errorResponse(res, 'Invalid or expired signature link', 404, 'INVALID_SIGNATURE_LINK');
    }

    const p = project as Record<string, unknown>;
    const expiresAt = p.contract_signature_expires_at as string | null;

    // Check if token is expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return errorResponse(res, 'This signature link has expired. Please request a new one.', 410, 'SIGNATURE_LINK_EXPIRED');
    }

    // Check if already signed
    if (p.contract_signed_at) {
      return errorResponse(res, 'This contract has already been signed.', 400, 'CONTRACT_ALREADY_SIGNED');
    }

    // Log view
    const projectId = p.id as number;
    await db.run(
      `INSERT INTO contract_signature_log (project_id, action, actor_ip, actor_user_agent)
       VALUES (?, 'viewed', ?, ?)`,
      [projectId, req.ip || 'unknown', req.get('user-agent') || 'unknown']
    );

    const latestContract = await db.get(
      `SELECT id, status FROM contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    if (latestContract && (latestContract as Record<string, unknown>).status !== 'signed') {
      await db.run(
        'UPDATE contracts SET status = \'viewed\', updated_at = datetime(\'now\') WHERE id = ?',
        [(latestContract as Record<string, unknown>).id as number]
      );
    }

    res.json({
      projectId: projectId,
      projectName: p.project_name,
      price: p.price,
      clientName: p.client_name,
      clientEmail: p.client_email,
      expiresAt: expiresAt,
      contractPdfUrl: `/api/projects/${projectId}/contract/pdf`
    });
  })
);

/**
 * POST /api/projects/contract/sign-by-token/:token
 * Sign contract using token (PUBLIC - no auth required)
 */
router.post(
  '/contract/sign-by-token/:token',
  asyncHandler(async (req: express.Request, res: Response) => {
    const { token } = req.params;
    const { signatureData, signerName, agreedToTerms } = req.body;
    const db = getDatabase();

    if (!signatureData || !signerName) {
      return errorResponse(res, 'Signature and name are required', 400, 'MISSING_SIGNATURE');
    }

    if (!agreedToTerms) {
      return errorResponse(res, 'You must agree to the terms to sign', 400, 'TERMS_NOT_ACCEPTED');
    }

    // Get project by token
    const project = await db.get(
      `SELECT p.id, p.project_name, p.contract_signature_expires_at, p.contract_signed_at,
              COALESCE(c.contact_name, c.company_name) as client_name, c.email as client_email
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.contract_signature_token = ?`,
      [token]
    );

    if (!project) {
      return errorResponse(res, 'Invalid or expired signature link', 404, 'INVALID_SIGNATURE_LINK');
    }

    const p = project as Record<string, unknown>;
    const projectId = p.id as number;
    const expiresAt = p.contract_signature_expires_at as string | null;
    const clientEmail = p.client_email as string;
    const clientName = p.client_name as string;
    const projectName = p.project_name as string;

    // Check if token is expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return errorResponse(res, 'This signature link has expired. Please request a new one.', 410, 'SIGNATURE_LINK_EXPIRED');
    }

    // Check if already signed
    if (p.contract_signed_at) {
      return errorResponse(res, 'This contract has already been signed.', 400, 'CONTRACT_ALREADY_SIGNED');
    }

    const signerIp = req.ip || req.socket.remoteAddress || 'unknown';
    const signerUserAgent = req.get('user-agent') || 'unknown';
    const signedAt = new Date().toISOString();

    // Update the project with signature
    await db.run(
      `UPDATE projects SET
        contract_signed_at = ?,
        contract_signature_token = NULL,
        contract_signature_expires_at = NULL,
        contract_signer_name = ?,
        contract_signer_email = ?,
        contract_signer_ip = ?,
        contract_signer_user_agent = ?,
        contract_signature_data = ?
       WHERE id = ?`,
      [signedAt, signerName, clientEmail, signerIp, signerUserAgent, signatureData, projectId]
    );

    const latestContract = await db.get(
      `SELECT id FROM contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    if (latestContract) {
      const contractId = (latestContract as Record<string, unknown>).id as number;
      // Clear signature token and update signature data (Phase 3.3 normalization)
      await db.run(
        `UPDATE contracts SET
          status = 'signed',
          signed_at = ?,
          signature_token = NULL,
          signature_expires_at = NULL,
          signer_name = ?,
          signer_email = ?,
          signer_ip = ?,
          signer_user_agent = ?,
          signature_data = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
        [signedAt, signerName, clientEmail, signerIp, signerUserAgent, signatureData, contractId]
      );
    }

    // Log signature to audit log (include contract_id for Phase 3.3)
    const contractId = latestContract ? (latestContract as Record<string, unknown>).id as number : null;
    await db.run(
      `INSERT INTO contract_signature_log (project_id, contract_id, action, actor_email, actor_ip, actor_user_agent, details)
       VALUES (?, ?, 'signed', ?, ?, ?, ?)`,
      [projectId, contractId, clientEmail, signerIp, signerUserAgent, JSON.stringify({ signerName, signedAt })]
    );

    // Send confirmation email to client
    const { emailService } = await import('../../services/email-service.js');
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    await emailService.sendEmail({
      to: clientEmail,
      subject: `Contract Signed - ${projectName}`,
      text: `
Hi ${clientName || signerName},

Thank you for signing the contract for "${projectName}".

Signature Details:
- Signed by: ${signerName}
- Date/Time: ${new Date(signedAt).toLocaleString()}
- IP Address: ${signerIp}

You can download a copy of the signed contract here:
${baseUrl}/api/projects/${projectId}/contract/pdf

We're excited to get started on your project! We'll be in touch soon with next steps.

Best regards,
${BUSINESS_INFO.name}
${BUSINESS_INFO.email}
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #00aff0; margin: 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
    .success { background: #d4edda; padding: 15px; border-radius: 6px; text-align: center; margin-bottom: 20px; }
    .success h2 { color: #155724; margin: 0; }
    .details { background: white; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .details table { width: 100%; }
    .details td { padding: 8px 0; }
    .details td:first-child { color: #666; }
    .btn { display: inline-block; padding: 14px 28px; background: #00aff0; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${BUSINESS_INFO.name}</h1>
    </div>
    <div class="content">
      <div class="success">
        <h2>Contract Signed Successfully</h2>
      </div>
      <p>Hi ${clientName || signerName},</p>
      <p>Thank you for signing the contract for <strong>"${projectName}"</strong>.</p>
      <div class="details">
        <table>
          <tr><td>Signed by:</td><td><strong>${signerName}</strong></td></tr>
          <tr><td>Date/Time:</td><td>${new Date(signedAt).toLocaleString()}</td></tr>
          <tr><td>IP Address:</td><td>${signerIp}</td></tr>
        </table>
      </div>
      <p style="text-align: center; margin: 25px 0;">
        <a href="${baseUrl}/api/projects/${projectId}/contract/pdf" class="btn">Download Contract</a>
      </p>
      <p>We're excited to get started on your project! We'll be in touch soon with next steps.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>${BUSINESS_INFO.name}<br>${BUSINESS_INFO.email}</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    });

    // Send notification to admin
    await emailService.sendEmail({
      to: BUSINESS_INFO.email,
      subject: `[Signed] Contract for ${projectName}`,
      text: `Contract signed for "${projectName}" by ${signerName} (${clientEmail}) from IP ${signerIp} at ${new Date(signedAt).toLocaleString()}.`,
      html: `<p>Contract signed for <strong>"${projectName}"</strong> by ${signerName} (${clientEmail}) from IP ${signerIp} at ${new Date(signedAt).toLocaleString()}.</p>`
    });

    logger.info(`[CONTRACT] Contract signed for project ${projectId} by ${signerName}`);

    // Emit contract.signed event for workflow automations
    await workflowTriggerService.emit('contract.signed', {
      entityId: contractId,
      triggeredBy: clientEmail,
      projectId,
      signerName,
      signerEmail: clientEmail
    });

    // Cancel pending contract reminders since contract is now signed
    try {
      const scheduler = getSchedulerService();
      await scheduler.cancelContractReminders(projectId);
    } catch (reminderError) {
      logger.error('[CONTRACT] Failed to cancel contract reminders:', { error: reminderError instanceof Error ? reminderError : undefined });
      // Continue - don't fail the signing if reminder cancellation fails
    }

    res.json({
      success: true,
      message: 'Contract signed successfully',
      signedAt,
      signerName
    });
  })
);

/**
 * POST /api/projects/:id/contract/countersign
 * Countersign a contract (ADMIN ONLY)
 */
router.post(
  '/:id/contract/countersign',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const { signatureData, signerName } = req.body;
    const db = getDatabase();

    if (!signerName) {
      return errorResponse(res, 'Signer name is required', 400, 'MISSING_SIGNER_NAME');
    }

    const project = await db.get(
      `SELECT id, project_name, contract_signed_at
       FROM projects
       WHERE id = ?`,
      [projectId]
    );

    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const p = project as Record<string, unknown>;

    if (!p.contract_signed_at) {
      return errorResponse(res, 'Client signature is required before countersigning.', 400, 'CLIENT_SIGNATURE_REQUIRED');
    }

    const countersignedAt = new Date().toISOString();
    const countersignerIp = req.ip || req.socket.remoteAddress || 'unknown';
    const countersignerUserAgent = req.get('user-agent') || 'unknown';
    const countersignerEmail = req.user?.email || 'admin';

    await db.run(
      `UPDATE projects SET
        contract_countersigned_at = ?,
        contract_countersigner_name = ?,
        contract_countersigner_email = ?,
        contract_countersigner_ip = ?,
        contract_countersigner_user_agent = ?,
        contract_countersignature_data = ?
       WHERE id = ?`,
      [countersignedAt, signerName, countersignerEmail, countersignerIp, countersignerUserAgent, signatureData || null, projectId]
    );

    const latestContract = await db.get(
      `SELECT id FROM contracts WHERE project_id = ? AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    if (latestContract) {
      await db.run(
        `UPDATE contracts SET
          status = 'signed',
          countersigned_at = ?,
          countersigner_name = ?,
          countersigner_email = ?,
          countersigner_ip = ?,
          countersigner_user_agent = ?,
          countersignature_data = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
        [countersignedAt, signerName, countersignerEmail, countersignerIp, countersignerUserAgent, signatureData || null, (latestContract as Record<string, unknown>).id]
      );
    }

    await db.run(
      `INSERT INTO contract_signature_log (project_id, action, actor_email, actor_ip, actor_user_agent, details)
       VALUES (?, 'countersigned', ?, ?, ?, ?)`,
      [projectId, countersignerEmail, countersignerIp, countersignerUserAgent, JSON.stringify({ signerName, countersignedAt })]
    );

    res.json({
      success: true,
      message: 'Contract countersigned successfully',
      countersignedAt,
      signerName
    });
  })
);

/**
 * GET /api/projects/:id/contract/signature-status
 * Get contract signature status for a project
 */
router.get(
  '/:id/contract/signature-status',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const project = await db.get(
      `SELECT contract_signed_at, contract_signature_requested_at, contract_signature_expires_at,
              contract_signer_name, contract_signer_email, contract_signer_ip,
              contract_countersigned_at, contract_countersigner_name, contract_countersigner_email,
              contract_countersigner_ip, contract_signed_pdf_path
       FROM projects WHERE id = ?`,
      [projectId]
    );

    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const p = project as Record<string, unknown>;

    res.json({
      isSigned: !!p.contract_signed_at,
      signedAt: p.contract_signed_at,
      signerName: p.contract_signer_name,
      signerEmail: p.contract_signer_email,
      signerIp: p.contract_signer_ip,
      requestedAt: p.contract_signature_requested_at,
      expiresAt: p.contract_signature_expires_at,
      countersignedAt: p.contract_countersigned_at,
      countersignerName: p.contract_countersigner_name,
      countersignerEmail: p.contract_countersigner_email,
      countersignerIp: p.contract_countersigner_ip,
      signedPdfPath: p.contract_signed_pdf_path
    });
  })
);

export default router;
