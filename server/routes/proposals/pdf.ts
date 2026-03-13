/**
 * ===============================================
 * PROPOSAL PDF GENERATION
 * ===============================================
 * @file server/routes/proposals/pdf.ts
 *
 * PDF generation endpoint for proposals.
 * Renders a multi-page proposal document with header, pricing, terms, and signature.
 */

import express, { Response } from 'express';
import {
  asyncHandler,
  authenticateToken,
  canAccessProposal,
  getString,
  getNumber,
  logger,
  ErrorCodes,
  errorResponse,
  proposalService,
  BUSINESS_INFO,
  PDFLibDocument,
  StandardFonts,
  degrees,
  getPdfCacheKey,
  getCachedPdf,
  cachePdf,
  PAGE_MARGINS,
  ensureSpace,
  addPageNumbers,
  drawPdfDocumentHeader
} from './helpers.js';
import type {
  AuthenticatedRequest,
  PdfPageContext
} from './helpers.js';
import type {
  ProposalPdfRow,
  ProposalFeatureSelectionRow,
  ProposalSignatureForPdf
} from '../../services/proposal-service.js';
import { PDF_COLORS, PDF_TYPOGRAPHY, PDF_SPACING } from '../../config/pdf-styles.js';

const router = express.Router();

/**
 * @swagger
 * /api/proposals/{id}/pdf:
 *   get:
 *     tags: [Proposals]
 *     summary: GET /api/proposals/:id/pdf
 *     description: GET /api/proposals/:id/pdf.
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
  '/:id/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const proposalId = parseInt(id, 10);

    // Validate ID
    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Authorization check: only admin or owning client can download PDF
    if (!(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Get proposal with full details via service
    const proposal = await proposalService.getProposalWithJoinsForPdf(proposalId);

    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Check cache first (proposals use created_at as they don't have updated_at)
    const cacheKey = getPdfCacheKey('proposal', id, proposal.created_at);
    const cachedPdf = getCachedPdf(cacheKey);
    if (cachedPdf) {
      const projectName = (proposal.project_name || 'proposal')
        .toString()
        .replace(/[^a-zA-Z0-9]/g, '-');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="proposal-${projectName}-${proposalId}.pdf"`
      );
      res.setHeader('Content-Length', cachedPdf.length);
      res.setHeader('X-PDF-Cache', 'HIT');
      return res.send(Buffer.from(cachedPdf));
    }

    // Cast proposal for helper functions
    const p = proposal as unknown as Record<string, unknown>;

    // Get feature selections via service
    const features = await proposalService.getProposalFeatureSelectionsForPdf(proposalId);

    // Get signature data if proposal is signed
    const signature: ProposalSignatureForPdf | undefined = proposal.signed_at
      ? await proposalService.getProposalLatestSignatureForPdf(proposalId)
      : undefined;

    // Check if proposal is signed for watermark
    const isSigned = Boolean(proposal.signed_at);

    // Helper functions
    const formatDate = (dateStr: string | undefined | null): string => {
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

    const formatTier = (tier: string): string => {
      const tierNames: Record<string, string> = { good: 'GOOD', better: 'BETTER', best: 'BEST' };
      return tierNames[tier] || tier.toUpperCase();
    };

    const formatMaintenance = (option: string | null): string => {
      if (!option) return 'None';
      const maintenanceNames: Record<string, string> = {
        diy: 'DIY (Self-Managed)',
        essential: 'Essential Plan',
        standard: 'Standard Plan',
        premium: 'Premium Plan'
      };
      return maintenanceNames[option] || option;
    };

    // Create PDF document using pdf-lib with multi-page support
    const pdfDoc = await PDFLibDocument.create();
    pdfDoc.setTitle(`Proposal - ${getString(p, 'project_name')}`);
    pdfDoc.setAuthor(BUSINESS_INFO.name);

    // Embed fonts first
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Create multi-page context
    const pageWidth = 612;
    const pageHeight = 792;
    const currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    const { width, height } = currentPage.getSize();

    // Build context for page break detection
    const ctx: PdfPageContext = {
      pdfDoc,
      currentPage,
      pageNumber: 1,
      y: height - 43,
      width: pageWidth,
      height: pageHeight,
      leftMargin: PAGE_MARGINS.left,
      rightMargin: pageWidth - PAGE_MARGINS.right,
      topMargin: PAGE_MARGINS.top,
      bottomMargin: PAGE_MARGINS.bottom,
      contentWidth: pageWidth - PAGE_MARGINS.left - PAGE_MARGINS.right,
      fonts: { regular: helvetica, bold: helveticaBold }
    };

    // Helper to get current page
    const page = () => ctx.currentPage;

    // Helper for continuation header on new pages
    const drawContinuationHeader = (context: PdfPageContext) => {
      context.currentPage.drawText('Proposal (continued)', {
        x: ctx.leftMargin,
        y: context.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: helvetica,
        color: PDF_COLORS.continuationHeader
      });
      context.y -= 20;
    };

    // Layout constants
    const leftMargin = ctx.leftMargin;
    const rightMargin = ctx.rightMargin;

    // === HEADER ===
    ctx.y = await drawPdfDocumentHeader({
      page: page(),
      pdfDoc,
      fonts: { regular: helvetica, bold: helveticaBold },
      startY: ctx.y,
      leftMargin,
      rightMargin,
      title: 'PROPOSAL'
    });

    // === PROPOSAL INFO - Two columns ===
    const rightCol = width / 2 + 36;

    // Left side - Prepared For
    page().drawText('Prepared For:', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.subtitle
    });
    page().drawText(getString(p, 'client_name') || 'Client', {
      x: leftMargin,
      y: ctx.y - 15,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    let clientLineY = ctx.y - 30;
    if (proposal.company_name) {
      page().drawText(proposal.company_name, {
        x: leftMargin,
        y: clientLineY,
        size: 10,
        font: helvetica,
        color: PDF_COLORS.black
      });
      clientLineY -= 15;
    }
    page().drawText(getString(p, 'client_email') || '', {
      x: leftMargin,
      y: clientLineY,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.bodyLight
    });

    // Right side - Prepared By & Date
    page().drawText('Prepared By:', {
      x: rightCol,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.subtitle
    });
    page().drawText(BUSINESS_INFO.name, {
      x: rightCol,
      y: ctx.y - 15,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    page().drawText('Date:', {
      x: rightCol,
      y: ctx.y - 45,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.subtitle
    });
    page().drawText(formatDate(getString(p, 'created_at')), {
      x: rightCol,
      y: ctx.y - 60,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });

    ctx.y -= 90;

    // === PROJECT DETAILS ===
    page().drawText('Project Details', {
      x: leftMargin,
      y: ctx.y,
      size: 14,
      font: helveticaBold,
      color: PDF_COLORS.sectionHeading
    });
    ctx.y -= 18;

    page().drawText('Project:', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    page().drawText(getString(p, 'project_name'), {
      x: leftMargin + 55,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    ctx.y -= 15;

    page().drawText('Project Type:', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    page().drawText(
      getString(p, 'project_type')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      { x: leftMargin + 80, y: ctx.y, size: 10, font: helvetica, color: PDF_COLORS.black }
    );
    ctx.y -= 25;

    // === SELECTED PACKAGE ===
    page().drawText('Selected Package', {
      x: leftMargin,
      y: ctx.y,
      size: 14,
      font: helveticaBold,
      color: PDF_COLORS.sectionHeading
    });
    ctx.y -= 18;

    const selectedTier = formatTier(getString(p, 'selected_tier'));
    page().drawText(`${selectedTier} Tier`, {
      x: leftMargin,
      y: ctx.y,
      size: 12,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    ctx.y -= 15;
    page().drawText(`Base Price: $${getNumber(p, 'base_price').toLocaleString()}`, {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    ctx.y -= 20;

    // === INCLUDED FEATURES ===
    const includedFeatures = features.filter((f) => f.is_included_in_tier);
    if (includedFeatures.length > 0) {
      page().drawText('Included Features:', {
        x: leftMargin,
        y: ctx.y,
        size: 12,
        font: helveticaBold,
        color: PDF_COLORS.black
      });
      ctx.y -= 15;
      for (const f of includedFeatures) {
        // Check for page break before each feature
        ensureSpace(ctx, 12, drawContinuationHeader);
        const fr = f as unknown as Record<string, unknown>;
        page().drawText(`• ${getString(fr, 'feature_name')}`, {
          x: leftMargin + 10,
          y: ctx.y,
          size: 10,
          font: helvetica,
          color: PDF_COLORS.black
        });
        ctx.y -= 12;
      }
      ctx.y -= 8;
    }

    // === ADD-ONS ===
    const addons = features.filter((f) => f.is_addon);
    if (addons.length > 0) {
      // Check for page break before add-ons section
      ensureSpace(ctx, 30, drawContinuationHeader);
      page().drawText('Add-Ons:', {
        x: leftMargin,
        y: ctx.y,
        size: 12,
        font: helveticaBold,
        color: PDF_COLORS.black
      });
      ctx.y -= 15;
      for (const f of addons) {
        // Check for page break before each add-on
        ensureSpace(ctx, 12, drawContinuationHeader);
        const fr = f as unknown as Record<string, unknown>;
        const price = getNumber(fr, 'feature_price');
        page().drawText(`• ${getString(fr, 'feature_name')} - $${price.toLocaleString()}`, {
          x: leftMargin + 10,
          y: ctx.y,
          size: 10,
          font: helvetica,
          color: PDF_COLORS.black
        });
        ctx.y -= 12;
      }
      ctx.y -= 8;
    }

    // === MAINTENANCE OPTION ===
    if (proposal.maintenance_option) {
      ensureSpace(ctx, 40, drawContinuationHeader);
      page().drawText('Maintenance Plan:', {
        x: leftMargin,
        y: ctx.y,
        size: 12,
        font: helveticaBold,
        color: PDF_COLORS.black
      });
      ctx.y -= 15;
      page().drawText(formatMaintenance(proposal.maintenance_option), {
        x: leftMargin + 10,
        y: ctx.y,
        size: 10,
        font: helvetica,
        color: PDF_COLORS.black
      });
      ctx.y -= 20;
    }

    // === PRICING SUMMARY ===
    // Ensure pricing summary fits on current page
    ensureSpace(ctx, 100, drawContinuationHeader);
    ctx.y -= 10;
    page().drawText('Pricing Summary', {
      x: leftMargin,
      y: ctx.y,
      size: 14,
      font: helveticaBold,
      color: PDF_COLORS.sectionHeading
    });
    ctx.y -= 18;

    page().drawText('Base Package Price:', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    const basePriceText = `$${getNumber(p, 'base_price').toLocaleString()}`;
    page().drawText(basePriceText, {
      x: rightMargin - helvetica.widthOfTextAtSize(basePriceText, 10),
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    ctx.y -= 15;

    if (addons.length > 0) {
      const addonsTotal = addons.reduce((sum, f) => sum + (f.feature_price || 0), 0);
      page().drawText('Add-Ons:', {
        x: leftMargin,
        y: ctx.y,
        size: 10,
        font: helvetica,
        color: PDF_COLORS.black
      });
      const addonsTotalText = `$${addonsTotal.toLocaleString()}`;
      page().drawText(addonsTotalText, {
        x: rightMargin - helvetica.widthOfTextAtSize(addonsTotalText, 10),
        y: ctx.y,
        size: 10,
        font: helvetica,
        color: PDF_COLORS.black
      });
      ctx.y -= 15;
    }

    // Line
    ctx.y -= 5;
    page().drawLine({
      start: { x: leftMargin, y: ctx.y },
      end: { x: rightMargin, y: ctx.y },
      thickness: PDF_SPACING.dividerThickness,
      color: PDF_COLORS.subtitle
    });
    ctx.y -= 15;

    // Total
    page().drawText('Total:', {
      x: leftMargin,
      y: ctx.y,
      size: 12,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    const totalText = `$${getNumber(p, 'final_price').toLocaleString()}`;
    page().drawText(totalText, {
      x: rightMargin - helveticaBold.widthOfTextAtSize(totalText, 12),
      y: ctx.y,
      size: 12,
      font: helveticaBold,
      color: PDF_COLORS.black
    });

    // === PAYMENT SCHEDULE ===
    ctx.y -= 35;
    ensureSpace(ctx, 100, drawContinuationHeader);
    page().drawText('Payment Schedule', {
      x: leftMargin,
      y: ctx.y,
      size: 14,
      font: helveticaBold,
      color: PDF_COLORS.sectionHeading
    });
    ctx.y -= 20;

    // Calculate payment amounts based on deposit percentage (default 50%)
    const finalPrice = getNumber(p, 'final_price');
    const depositPercentage = proposal.default_deposit_percentage || 50;
    const depositAmount = Math.round(finalPrice * (depositPercentage / 100));
    const finalPayment = finalPrice - depositAmount;

    // Draw payment schedule table
    const colWidth = ctx.contentWidth / 3;
    const paymentRowHeight = 18;

    // Table header
    page().drawText('Payment', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.bodyLight
    });
    page().drawText('When Due', {
      x: leftMargin + colWidth,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.bodyLight
    });
    page().drawText('Amount', {
      x: rightMargin - 70,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.bodyLight
    });
    ctx.y -= 5;

    // Header underline
    page().drawLine({
      start: { x: leftMargin, y: ctx.y },
      end: { x: rightMargin, y: ctx.y },
      thickness: PDF_SPACING.dividerThin,
      color: PDF_COLORS.divider
    });
    ctx.y -= paymentRowHeight;

    // Row 1: Deposit
    page().drawText('1. Deposit', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    page().drawText('Upon contract signing', {
      x: leftMargin + colWidth,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.muted
    });
    const depositText = `$${depositAmount.toLocaleString()}`;
    page().drawText(depositText, {
      x: rightMargin - helvetica.widthOfTextAtSize(depositText, 10),
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    ctx.y -= 5;

    // Row separator
    page().drawLine({
      start: { x: leftMargin, y: ctx.y },
      end: { x: rightMargin, y: ctx.y },
      thickness: PDF_SPACING.dividerVeryThin,
      color: PDF_COLORS.dividerVeryLight
    });
    ctx.y -= paymentRowHeight;

    // Row 2: Final Payment
    page().drawText('2. Final Payment', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    page().drawText('Upon project completion', {
      x: leftMargin + colWidth,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.muted
    });
    const finalPaymentText = `$${finalPayment.toLocaleString()}`;
    page().drawText(finalPaymentText, {
      x: rightMargin - helvetica.widthOfTextAtSize(finalPaymentText, 10),
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: PDF_COLORS.black
    });
    ctx.y -= 5;

    // Bottom line
    page().drawLine({
      start: { x: leftMargin, y: ctx.y },
      end: { x: rightMargin, y: ctx.y },
      thickness: PDF_SPACING.dividerThin,
      color: PDF_COLORS.divider
    });
    ctx.y -= paymentRowHeight;

    // Total row
    page().drawText('Total Project Investment', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    const totalInvestmentText = `$${finalPrice.toLocaleString()}`;
    page().drawText(totalInvestmentText, {
      x: rightMargin - helveticaBold.widthOfTextAtSize(totalInvestmentText, 10),
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    ctx.y -= 15;

    // Payment note
    page().drawText(
      `Deposit (${depositPercentage}%) required to begin work. Balance due upon delivery.`,
      {
        x: leftMargin,
        y: ctx.y,
        size: 8,
        font: helvetica,
        color: PDF_COLORS.faint
      }
    );

    // === CLIENT NOTES ===
    if (proposal.client_notes) {
      ctx.y -= 35;
      ensureSpace(ctx, 30, drawContinuationHeader);
      page().drawText('Client Notes:', {
        x: leftMargin,
        y: ctx.y,
        size: 12,
        font: helveticaBold,
        color: PDF_COLORS.black
      });
      ctx.y -= 15;
      page().drawText(proposal.client_notes, {
        x: leftMargin + 10,
        y: ctx.y,
        size: 10,
        font: helvetica,
        color: PDF_COLORS.black
      });
    }

    // === TERMS & CONDITIONS ===
    const termsText = proposal.terms_and_conditions || proposal.contract_terms;
    if (termsText) {
      ctx.y -= 35;
      ensureSpace(ctx, 80, drawContinuationHeader);
      page().drawText('Terms & Conditions', {
        x: leftMargin,
        y: ctx.y,
        size: 14,
        font: helveticaBold,
        color: PDF_COLORS.sectionHeading
      });
      ctx.y -= 18;

      // Split terms into lines and render each
      const termsLines = termsText.split('\n').filter((line: string) => line.trim());
      for (const line of termsLines) {
        ensureSpace(ctx, 14, drawContinuationHeader);
        // Wrap long lines
        const maxLineWidth = ctx.contentWidth - 20;
        const words = line.trim().split(' ');
        let currentLine = '';
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = helvetica.widthOfTextAtSize(testLine, 9);
          if (testWidth > maxLineWidth && currentLine) {
            page().drawText(currentLine, {
              x: leftMargin + 10,
              y: ctx.y,
              size: 9,
              font: helvetica,
              color: PDF_COLORS.bodyLight
            });
            ctx.y -= 12;
            ensureSpace(ctx, 12, drawContinuationHeader);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          page().drawText(currentLine, {
            x: leftMargin + 10,
            y: ctx.y,
            size: 9,
            font: helvetica,
            color: PDF_COLORS.bodyLight
          });
          ctx.y -= 12;
        }
      }
      ctx.y -= 10;
    }

    // === SIGNATURE BLOCK (if signed) ===
    if (isSigned && signature) {
      ctx.y -= 25;
      ensureSpace(ctx, 120, drawContinuationHeader);

      // Signature section header
      page().drawText('Authorization & Signature', {
        x: leftMargin,
        y: ctx.y,
        size: 14,
        font: helveticaBold,
        color: PDF_COLORS.sectionHeading
      });
      ctx.y -= 20;

      // Draw signature box
      const sigBoxY = ctx.y;
      const sigBoxHeight = 80;
      page().drawRectangle({
        x: leftMargin,
        y: sigBoxY - sigBoxHeight,
        width: ctx.contentWidth,
        height: sigBoxHeight,
        borderColor: PDF_COLORS.signatureBoxBorder,
        borderWidth: 1,
        color: PDF_COLORS.signatureBoxBg
      });

      // Embed signature image if available (drawn signature)
      if (signature.signature_data && signature.signature_method === 'drawn') {
        try {
          // signature_data is base64 PNG data
          const sigDataUrl = signature.signature_data;
          const base64Data = sigDataUrl.replace(/^data:image\/png;base64,/, '');
          const sigImageBytes = Buffer.from(base64Data, 'base64');
          const sigImage = await pdfDoc.embedPng(sigImageBytes);

          // Scale signature to fit in box (max 200x50)
          const maxSigWidth = 200;
          const maxSigHeight = 50;
          const sigAspect = sigImage.width / sigImage.height;
          let sigWidth = Math.min(sigImage.width, maxSigWidth);
          let sigHeight = sigWidth / sigAspect;
          if (sigHeight > maxSigHeight) {
            sigHeight = maxSigHeight;
            sigWidth = sigHeight * sigAspect;
          }

          // Center signature in left portion of box
          const sigX = leftMargin + 20;
          const sigY = sigBoxY - sigBoxHeight / 2 - sigHeight / 2 + 10;
          page().drawImage(sigImage, { x: sigX, y: sigY, width: sigWidth, height: sigHeight });
        } catch (sigError) {
          await logger.error('[Pdf] Failed to embed signature image:', {
            error: sigError instanceof Error ? sigError : undefined,
            category: 'PROPOSALS'
          });
        }
      } else if (signature.signature_data && signature.signature_method === 'typed') {
        // Typed signature - render as stylized text
        const typedSig = signature.signature_data;
        page().drawText(typedSig, {
          x: leftMargin + 20,
          y: sigBoxY - 45,
          size: 24,
          font: helvetica,
          color: PDF_COLORS.signatureBlue
        });
      }

      // Signer details on right side of box
      const detailsX = leftMargin + ctx.contentWidth / 2 + 20;
      let detailsY = sigBoxY - 20;

      page().drawText(signature.signer_name || 'Unknown', {
        x: detailsX,
        y: detailsY,
        size: 11,
        font: helveticaBold,
        color: PDF_COLORS.black
      });
      detailsY -= 14;

      if (signature.signer_title) {
        page().drawText(signature.signer_title, {
          x: detailsX,
          y: detailsY,
          size: 9,
          font: helvetica,
          color: PDF_COLORS.bodyLight
        });
        detailsY -= 12;
      }

      if (signature.signer_email) {
        page().drawText(signature.signer_email, {
          x: detailsX,
          y: detailsY,
          size: 9,
          font: helvetica,
          color: PDF_COLORS.bodyLight
        });
        detailsY -= 12;
      }

      // Signed date
      const signedDate = signature.signed_at
        ? formatDate(signature.signed_at)
        : formatDate(proposal.signed_at);
      page().drawText(`Signed: ${signedDate}`, {
        x: detailsX,
        y: detailsY,
        size: 9,
        font: helvetica,
        color: PDF_COLORS.muted
      });

      ctx.y = sigBoxY - sigBoxHeight - 15;

      // Legal binding notice
      page().drawText(
        'This document constitutes a legally binding agreement between the parties.',
        {
          x: leftMargin,
          y: ctx.y,
          size: 8,
          font: helvetica,
          color: PDF_COLORS.faint
        }
      );
      ctx.y -= 12;

      if (signature.ip_address) {
        page().drawText(`Signed from IP: ${signature.ip_address}`, {
          x: leftMargin,
          y: ctx.y,
          size: 7,
          font: helvetica,
          color: PDF_COLORS.whisper
        });
      }
    }

    // === FOOTER (on last page) ===
    const footerY = 60;
    const footerText1 = isSigned
      ? 'This signed proposal is a legally binding contract.'
      : 'This proposal is valid for 30 days from the date above.';
    const footerText2 = `Questions? Contact us at ${BUSINESS_INFO.email}`;
    page().drawText(footerText1, {
      x: (width - helvetica.widthOfTextAtSize(footerText1, 9)) / 2,
      y: footerY,
      size: 9,
      font: helvetica,
      color: PDF_COLORS.muted
    });
    page().drawText(footerText2, {
      x: (width - helvetica.widthOfTextAtSize(footerText2, 9)) / 2,
      y: footerY - 12,
      size: 9,
      font: helvetica,
      color: PDF_COLORS.muted
    });

    // Add page numbers if multiple pages
    if (ctx.pageNumber > 1) {
      await addPageNumbers(pdfDoc, {
        format: (pageNum, total) => `Page ${pageNum} of ${total}`,
        fontSize: 8,
        marginBottom: 20
      });
    }

    // === ADD "SIGNED" WATERMARK TO ALL PAGES (if signed) ===
    if (isSigned) {
      const pages = pdfDoc.getPages();
      for (const pg of pages) {
        const { width: pgWidth, height: pgHeight } = pg.getSize();

        // Draw diagonal "SIGNED" watermark
        pg.drawText('SIGNED', {
          x: pgWidth / 2 - 120,
          y: pgHeight / 2 - 30,
          size: 72,
          font: helveticaBold,
          color: PDF_COLORS.watermarkGreen,
          opacity: 0.08,
          rotate: degrees(-35)
        });
      }
    }

    // Generate PDF bytes and send
    const pdfBytes = await pdfDoc.save();
    const projectName = getString(p, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');

    // Cache the generated PDF
    cachePdf(cacheKey, pdfBytes, proposal.created_at);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="proposal-${projectName}-${id}.pdf"`
    );
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader('X-PDF-Cache', 'MISS');
    res.send(Buffer.from(pdfBytes));
  })
);

export { router as pdfRouter };
