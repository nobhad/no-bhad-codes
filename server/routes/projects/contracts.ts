import express, { Response } from 'express';
import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { PDFDocument as PDFLibDocument, StandardFonts, degrees, rgb, PDFPage } from 'pdf-lib';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject } from '../../utils/access-control.js';
import {
  getUploadsDir,
  getUploadsSubdir,
  getRelativePath,
  UPLOAD_DIRS,
  sanitizeFilename
} from '../../config/uploads.js';
import { getString } from '../../database/row-helpers.js';
import { getSchedulerService } from '../../services/scheduler-service.js';
import { BUSINESS_INFO, CONTRACT_TERMS } from '../../config/business.js';
import { PDF_COLORS } from '../../config/pdf-styles.js';
import {
  getPdfCacheKey,
  getCachedPdf,
  cachePdf,
  ensureSpace,
  drawWrappedText,
  addPageNumbers,
  PAGE_MARGINS,
  drawPdfDocumentHeader
} from '../../utils/pdf-utils.js';
import { invalidateCache } from '../../middleware/cache.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { sendPdfResponse } from '../../utils/pdf-generator.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import { logger } from '../../services/logger.js';
import { getBaseUrl } from '../../config/environment.js';
import { contractService } from '../../services/contract-service.js';

const router = express.Router();

/**
 * GET /api/projects/:id/contract/pdf
 * Generate PDF contract for a project
 */
router.get(
  '/:id/contract/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Get project with client info
    const project = await contractService.getProjectWithClientForPdf(projectId);

    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Cast project for helper functions
    const p = project as Record<string, unknown>;

    // Load latest contract draft (if any) for content and cache invalidation
    const contract = await contractService.getLatestActiveContract(projectId);
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
    const cacheKey = getPdfCacheKey(
      'contract',
      projectId,
      contractUpdatedAt || getString(project, 'updated_at')
    );
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
      if (!dateStr) {
        return new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
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

    const isSigned = Boolean(
      getString(p, 'contract_signed_at') || (contract?.signed_at as string | undefined)
    );
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

    // === HEADER ===
    y = await drawPdfDocumentHeader({
      page,
      pdfDoc,
      fonts: { regular: helvetica, bold: helveticaBold },
      startY: y,
      leftMargin,
      rightMargin,
      title: 'CONTRACT'
    });

    // === CONTRACT INFO - Two columns ===
    const rightCol = width / 2 + 36;

    // Left side - Client Info
    page.drawText('Client:', {
      x: leftMargin,
      y: y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    page.drawText(getString(p, 'client_name') || 'Client', {
      x: leftMargin,
      y: y - 15,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    let clientLineY = y - 30;
    if (p.company_name) {
      page.drawText(String(p.company_name), {
        x: leftMargin,
        y: clientLineY,
        size: 10,
        font: helvetica,
        color: PDF_COLORS.black
      });
      clientLineY -= 15;
    }
    page.drawText(getString(p, 'client_email') || '', {
      x: leftMargin,
      y: clientLineY,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });

    // Right side - Service Provider
    page.drawText('Service Provider:', {
      x: rightCol,
      y: y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    page.drawText(BUSINESS_INFO.name, {
      x: rightCol,
      y: y - 15,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    page.drawText('Contract Date:', {
      x: rightCol,
      y: y - 45,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    page.drawText(formatDate(getString(p, 'contract_signed_at') || getString(p, 'created_at')), {
      x: rightCol,
      y: y - 60,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });

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
      projectType
        ? `Project Type: ${projectType.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`
        : '',
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

    const contentSource =
      contractContent && contractContent.trim() ? contractContent : fallbackContent;
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
    ctx.currentPage.drawText('Signatures', {
      x: leftMargin,
      y: ctx.y,
      size: 12,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    ctx.y -= 22;

    const signatureWidth = 200;
    const signatureLineY = ctx.y - 30;
    const signedDate = isSigned
      ? formatDate(
        getString(p, 'contract_signed_at') || (contract?.signed_at as string | undefined)
      )
      : '______________';
    const countersignedAt =
      getString(p, 'contract_countersigned_at') ||
      (contract?.countersigned_at as string | undefined);
    const countersignedDate = countersignedAt ? formatDate(countersignedAt) : '______________';

    const clientSignatureData =
      getString(p, 'contract_signature_data') ||
      (contract ? getString(contract, 'signature_data') : '');
    const countersignatureData =
      getString(p, 'contract_countersignature_data') ||
      (contract ? getString(contract, 'countersignature_data') : '');
    const clientSignatureBytes = parseSignatureData(clientSignatureData);
    const countersignatureBytes = parseSignatureData(countersignatureData);

    const signatureImageHeight = 40;
    const signatureImageWidth = 140;

    ctx.currentPage.drawText('Client:', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    ctx.currentPage.drawLine({
      start: { x: leftMargin, y: signatureLineY },
      end: { x: leftMargin + signatureWidth, y: signatureLineY },
      thickness: 1,
      color: PDF_COLORS.black
    });
    if (clientSignatureBytes) {
      const clientSignatureImage = await pdfDoc.embedPng(clientSignatureBytes);
      ctx.currentPage.drawImage(clientSignatureImage, {
        x: leftMargin + 8,
        y: signatureLineY + 6,
        width: signatureImageWidth,
        height: signatureImageHeight
      });
    }
    ctx.currentPage.drawText(getString(p, 'client_name') || 'Client Name', {
      x: leftMargin,
      y: signatureLineY - 15,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    ctx.currentPage.drawText(`Date: ${signedDate}`, {
      x: leftMargin,
      y: signatureLineY - 30,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });

    ctx.currentPage.drawText('Service Provider:', {
      x: rightCol,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    ctx.currentPage.drawLine({
      start: { x: rightCol, y: signatureLineY },
      end: { x: rightCol + signatureWidth, y: signatureLineY },
      thickness: 1,
      color: PDF_COLORS.black
    });
    if (countersignatureBytes) {
      const countersignatureImage = await pdfDoc.embedPng(countersignatureBytes);
      ctx.currentPage.drawImage(countersignatureImage, {
        x: rightCol + 8,
        y: signatureLineY + 6,
        width: signatureImageWidth,
        height: signatureImageHeight
      });
    }
    ctx.currentPage.drawText(BUSINESS_INFO.name, {
      x: rightCol,
      y: signatureLineY - 15,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    ctx.currentPage.drawText(`Date: ${countersignedDate}`, {
      x: rightCol,
      y: signatureLineY - 30,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });

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
        color: PDF_COLORS.black
      });
      footerPage.drawText(footerContact, {
        x: (footerWidth - contactWidth) / 2,
        y: 40,
        size: 9,
        font: helvetica,
        color: PDF_COLORS.black
      });
    }

    await addPageNumbers(pdfDoc, { marginBottom: 30 });

    // Generate PDF bytes and send
    const pdfBytes = await pdfDoc.save();
    const projectName = getString(p, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');

    const countersignedAtValue =
      getString(p, 'contract_countersigned_at') ||
      (contract ? getString(contract, 'countersigned_at') : '');
    if (isSigned && countersignedAtValue && !signedPdfPath) {
      const contractsDir = getUploadsSubdir(UPLOAD_DIRS.CONTRACTS);
      const filename = sanitizeFilename(`contract-${projectName}-${projectId}.pdf`);
      const absolutePath = path.join(contractsDir, filename);
      writeFileSync(absolutePath, pdfBytes);
      const relativePath = getRelativePath(UPLOAD_DIRS.CONTRACTS, filename) as string;

      await contractService.updateProjectSignedPdfPath(projectId, relativePath);

      const latestContractId = await contractService.getLatestActiveContractId(projectId);
      if (latestContractId) {
        await contractService.updateContractSignedPdfPath(latestContractId, relativePath);
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
  invalidateCache(['projects', 'contracts']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Get project with client info
    const project = await contractService.getProjectWithClientForSignature(projectId);

    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const p = project as Record<string, unknown>;
    const clientEmail = p.client_email as string | null;
    const clientName = p.client_name as string | null;
    const projectName = p.project_name as string;

    if (!clientEmail) {
      return errorResponse(
        res,
        'No client email associated with this project',
        400,
        ErrorCodes.MISSING_CLIENT_EMAIL
      );
    }

    // Generate a signature token for the contract
    const crypto = await import('crypto');
    const signatureToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token valid for 7 days

    // Store the signature request (dual-write: projects + contracts for rollback)
    await contractService.storeProjectSignatureRequest(projectId, signatureToken, expiresAt.toISOString());

    const latestContractId = await contractService.getLatestActiveContractId(projectId);
    if (latestContractId) {
      // Write signature request to contracts table (Phase 3.3 normalization)
      await contractService.updateContractSignatureRequest(latestContractId, signatureToken, expiresAt.toISOString());
    }

    // Log signature request to audit log
    await contractService.logSignatureAction({
      projectId,
      action: 'requested',
      actorEmail: req.user?.email || 'admin',
      details: JSON.stringify({ clientEmail, expiresAt: expiresAt.toISOString() })
    });

    // Generate signature URL
    const baseUrl = getBaseUrl();
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

    logger.info(`[Contract] Signature request sent for project ${projectId} to ${clientEmail}`);

    // Schedule contract reminders
    try {
      const scheduler = getSchedulerService();
      await scheduler.scheduleContractReminders(projectId);
    } catch (reminderError) {
      logger.error('[Contract] Failed to schedule contract reminders:', {
        error: reminderError instanceof Error ? reminderError : undefined
      });
      // Continue - don't fail the request if reminder scheduling fails
    }

    sendSuccess(res, {
      clientEmail,
      expiresAt: expiresAt.toISOString(),
      emailSent: emailResult.success
    }, 'Signature request sent');
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

    const project = await contractService.getProjectBySignatureToken(token);

    if (!project) {
      return errorResponse(res, 'Invalid or expired signature link', 404, ErrorCodes.INVALID_SIGNATURE_LINK);
    }

    const p = project as Record<string, unknown>;
    const expiresAt = p.contract_signature_expires_at as string | null;

    // Check if token is expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return errorResponse(
        res,
        'This signature link has expired. Please request a new one.',
        410,
        ErrorCodes.SIGNATURE_LINK_EXPIRED
      );
    }

    // Check if already signed
    if (p.contract_signed_at) {
      return errorResponse(
        res,
        'This contract has already been signed.',
        400,
        ErrorCodes.CONTRACT_ALREADY_SIGNED
      );
    }

    // Log view (truncate User-Agent to prevent log bloat)
    const projectId = p.id as number;
    const userAgent = (req.get('user-agent') || 'unknown').substring(0, 500);
    await contractService.logContractView(projectId, req.ip || 'unknown', userAgent);

    const latestContract = await contractService.getLatestActiveContractIdAndStatus(projectId);

    if (latestContract && latestContract.status !== 'signed') {
      await contractService.markContractViewed(latestContract.id);
    }

    sendSuccess(res, {
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
  invalidateCache(['projects', 'contracts']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const { token } = req.params;
    const { signatureData, signerName, agreedToTerms } = req.body;

    if (!signatureData || !signerName) {
      return errorResponse(res, 'Signature and name are required', 400, ErrorCodes.MISSING_SIGNATURE);
    }

    if (!agreedToTerms) {
      return errorResponse(res, 'You must agree to the terms to sign', 400, ErrorCodes.TERMS_NOT_ACCEPTED);
    }

    // Get project by token
    const project = await contractService.getProjectByTokenForSigning(token);

    if (!project) {
      return errorResponse(res, 'Invalid or expired signature link', 404, ErrorCodes.INVALID_SIGNATURE_LINK);
    }

    const p = project as Record<string, unknown>;
    const projectId = p.id as number;
    const expiresAt = p.contract_signature_expires_at as string | null;
    const clientEmail = p.client_email as string;
    const clientName = p.client_name as string;
    const projectName = p.project_name as string;

    // Check if token is expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return errorResponse(
        res,
        'This signature link has expired. Please request a new one.',
        410,
        ErrorCodes.SIGNATURE_LINK_EXPIRED
      );
    }

    // Check if already signed
    if (p.contract_signed_at) {
      return errorResponse(
        res,
        'This contract has already been signed.',
        400,
        ErrorCodes.CONTRACT_ALREADY_SIGNED
      );
    }

    const signerIp = req.ip || req.socket.remoteAddress || 'unknown';
    const signerUserAgent = (req.get('user-agent') || 'unknown').substring(0, 500);
    const signedAt = new Date().toISOString();

    // Update the project with signature
    await contractService.updateProjectWithSignature(projectId, {
      signedAt,
      signerName,
      clientEmail,
      signerIp,
      signerUserAgent,
      signatureData
    });

    const latestContractId = await contractService.getLatestActiveContractId(projectId);

    if (latestContractId) {
      // Clear signature token and update signature data (Phase 3.3 normalization)
      await contractService.updateContractWithSignature(latestContractId, {
        signedAt,
        signerName,
        clientEmail,
        signerIp,
        signerUserAgent,
        signatureData
      });
    }

    // Log signature to audit log (include contract_id for Phase 3.3)
    const contractId = latestContractId;
    await contractService.logSignatureAction({
      projectId,
      contractId,
      action: 'signed',
      actorEmail: clientEmail,
      actorIp: signerIp,
      actorUserAgent: signerUserAgent,
      details: JSON.stringify({ signerName, signedAt })
    });

    // Send confirmation email to client
    const { emailService } = await import('../../services/email-service.js');
    const baseUrl = getBaseUrl();

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

    logger.info(`[Contract] Contract signed for project ${projectId} by ${signerName}`);

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
      logger.error('[Contract] Failed to cancel contract reminders:', {
        error: reminderError instanceof Error ? reminderError : undefined
      });
      // Continue - don't fail the signing if reminder cancellation fails
    }

    sendSuccess(res, {
      signedAt,
      signerName
    }, 'Contract signed successfully');
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
  invalidateCache(['projects', 'contracts']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { signatureData, signerName } = req.body;

    if (!signerName) {
      return errorResponse(res, 'Signer name is required', 400, ErrorCodes.MISSING_SIGNER_NAME);
    }

    const project = await contractService.getProjectForCountersign(projectId);

    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const p = project as Record<string, unknown>;

    if (!p.contract_signed_at) {
      return errorResponse(
        res,
        'Client signature is required before countersigning.',
        400,
        ErrorCodes.CLIENT_SIGNATURE_REQUIRED
      );
    }

    const countersignedAt = new Date().toISOString();
    const countersignerIp = req.ip || req.socket.remoteAddress || 'unknown';
    const countersignerUserAgent = (req.get('user-agent') || 'unknown').substring(0, 500);
    const countersignerEmail = req.user?.email || 'admin';

    const countersignData = {
      countersignedAt,
      signerName,
      countersignerEmail,
      countersignerIp,
      countersignerUserAgent,
      signatureData: signatureData || null
    };

    await contractService.updateProjectWithCountersignature(projectId, countersignData);

    const latestContractId = await contractService.getLatestActiveContractId(projectId);
    if (latestContractId) {
      await contractService.updateContractWithCountersignature(latestContractId, countersignData);
    }

    await contractService.logSignatureAction({
      projectId,
      action: 'countersigned',
      actorEmail: countersignerEmail,
      actorIp: countersignerIp,
      actorUserAgent: countersignerUserAgent,
      details: JSON.stringify({ signerName, countersignedAt })
    });

    sendSuccess(res, {
      countersignedAt,
      signerName
    }, 'Contract countersigned successfully');
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
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const project = await contractService.getProjectSignatureStatus(projectId);

    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const p = project as Record<string, unknown>;

    sendSuccess(res, {
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
