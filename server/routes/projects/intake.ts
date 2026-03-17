import express, { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject } from '../../utils/access-control.js';
import { getString } from '../../database/row-helpers.js';
import { BUSINESS_INFO } from '../../config/business.js';
import { PDF_COLORS, PDF_TYPOGRAPHY, PDF_SPACING } from '../../config/pdf-styles.js';
import {
  getPdfCacheKey,
  getCachedPdf,
  cachePdf,
  drawPdfFooter,
  drawPdfDocumentHeader,
  drawTwoColumnInfo,
  drawSectionLabel,
  drawLabelValue,
  addPageNumbers,
  PAGE_MARGINS,
  ensureSpace,
  drawWrappedText,
  getRegularFontBytes,
  getBoldFontBytes,
  registerFontkit,
  type PdfPageContext
} from '../../utils/pdf-utils.js';
import { errorResponse, ErrorCodes } from '../../utils/api-response.js';
import { sendPdfResponse } from '../../utils/pdf-generator.js';
import { intakeService } from '../../services/intake-service.js';

const router = express.Router();

interface IntakeDocument {
  submittedAt: string;
  projectId: number;
  projectName: string;
  createdBy?: string;
  clientInfo: {
    name: string;
    email: string;
    phone?: string | null;
    projectFor?: string;
    companyName?: string | null;
    companyWebsite?: string | null;
    timezone?: string | null;
    preferredContact?: string | null;
    preferredContactMethod?: string | null;
  };
  projectDetails: {
    type: string;
    description: string;
    timeline: string;
    budget: string;
    targetLaunchDate?: string | null;
    targetAudience?: string | null;
    features?: string[];
    designLevel?: string | null;
  };
  requirements?: {
    designStyle?: string | null;
    colorPreferences?: string | null;
    brandGuidelines?: boolean;
    contentReady?: boolean;
    features?: string[];
    integrations?: string | null;
    additionalNotes?: string | null;
  };
  technicalInfo?: {
    techComfort?: string | null;
    domainHosting?: string | null;
  };
  assets?: {
    logoProvided?: boolean;
    existingAssets?: string | null;
    contentAccess?: string | null;
  };
  additionalInfo?: string | null;
  note?: string | null;
}

/**
 * GET /api/projects/:id/intake/pdf
 * Generate a branded PDF from the project's intake form using pdf-lib
 */
router.get(
  '/:id/intake/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Get project with client info
    const project = await intakeService.getProjectWithClientForIntakePdf(projectId);

    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const p = project;

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Find the intake file for this project
    const intakeFileRecord = await intakeService.getIntakeFileForProject(projectId);

    if (!intakeFileRecord) {
      return errorResponse(res, 'Intake form not found for this project', 404, ErrorCodes.FILE_NOT_FOUND);
    }
    const cacheKey = getPdfCacheKey(
      'intake',
      projectId,
      getString(intakeFileRecord, 'updated_at') || getString(intakeFileRecord, 'created_at')
    );
    const cachedPdf = getCachedPdf(cacheKey);
    if (cachedPdf) {
      const clientOrCompany = getString(p, 'company_name') || getString(p, 'client_name');
      const safeClientName = clientOrCompany
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50);
      return sendPdfResponse(res, cachedPdf, {
        filename: `nobhadcodes_intake_${safeClientName}.pdf`,
        disposition: 'inline',
        cacheStatus: 'HIT'
      });
    }

    // Read the intake JSON file
    const filePath = join(process.cwd(), getString(intakeFileRecord, 'file_path'));
    if (!existsSync(filePath)) {
      return errorResponse(res, 'Intake file not found on disk', 404, ErrorCodes.FILE_NOT_FOUND);
    }

    let intakeData: IntakeDocument;
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      intakeData = JSON.parse(fileContent);
    } catch {
      return errorResponse(res, 'Failed to read intake file', 500, ErrorCodes.INTERNAL_ERROR);
    }

    // =========================================================
    // FORMAT HELPERS
    // =========================================================

    const formatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return 'N/A';
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    };

    const formatTimeline = (timeline: string): string => {
      const map: Record<string, string> = {
        asap: 'As Soon As Possible',
        '1-month': '1 Month',
        '1-3-months': '1-3 Months',
        '3-6-months': '3-6 Months',
        flexible: 'Flexible'
      };
      return map[timeline] || timeline;
    };

    const formatBudget = (budget: string): string => {
      const map: Record<string, string> = {
        'under-2k': 'Under $2,000',
        '2k-5k': '$2,000 - $5,000',
        '2.5k-5k': '$2,500 - $5,000',
        '5k-10k': '$5,000 - $10,000',
        '10k-25k': '$10,000 - $25,000',
        '25k+': '$25,000+'
      };
      return map[budget] || budget;
    };

    const formatProjectType = (type: string): string => {
      const map: Record<string, string> = {
        'simple-site': 'Simple Website',
        'business-site': 'Business Website',
        portfolio: 'Portfolio Website',
        'e-commerce': 'E-commerce Store',
        ecommerce: 'E-commerce Store',
        'web-app': 'Web Application',
        'browser-extension': 'Browser Extension',
        other: 'Custom Project'
      };
      return map[type] || type.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    };

    const formatContact = (val: string): string => {
      const map: Record<string, string> = {
        email: 'Email',
        phone: 'Phone',
        either: 'Either'
      };
      return map[val.toLowerCase()] || val;
    };

    const decodeHtml = (text: string): string => {
      return text
        .replace(/&amp;/g, '&')
        .replace(/&#x2F;/g, '/')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'');
    };

    const sanitize = (text: string): string => {
      return text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    };

    const clean = (text: string): string => sanitize(decodeHtml(text));

    // =========================================================
    // PDF SETUP
    // =========================================================

    const pdfDoc = await PDFLibDocument.create();

    const pdfClientName = getString(p, 'company_name') || getString(p, 'client_name') || 'Client';
    pdfDoc.setTitle(`NoBhadCodes Intake - ${pdfClientName}`);
    pdfDoc.setAuthor(BUSINESS_INFO.name);
    pdfDoc.setSubject('Project Intake Form');
    pdfDoc.setCreator('NoBhadCodes');

    registerFontkit(pdfDoc);
    const helvetica = await pdfDoc.embedFont(getRegularFontBytes());
    const helveticaBold = await pdfDoc.embedFont(getBoldFontBytes());

    const PAGE_W = 612;
    const PAGE_H = 792;
    const LEFT = PAGE_MARGINS.left;
    const RIGHT = PAGE_W - PAGE_MARGINS.right;

    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

    const ctx: PdfPageContext = {
      pdfDoc,
      currentPage: page,
      pageNumber: 1,
      y: PAGE_H - 43,
      width: PAGE_W,
      height: PAGE_H,
      leftMargin: LEFT,
      rightMargin: RIGHT,
      topMargin: PAGE_MARGINS.top,
      bottomMargin: PAGE_MARGINS.bottom,
      contentWidth: RIGHT - LEFT,
      fonts: { regular: helvetica, bold: helveticaBold }
    };

    const fonts = ctx.fonts;
    const labelWidth = 120;
    const lineHeight = PDF_SPACING.lineHeight;

    // Continuation header on new pages
    const onNewPage = (pageCtx: PdfPageContext) => {
      pageCtx.currentPage.drawText(`Intake: ${pdfClientName} (continued)`, {
        x: pageCtx.leftMargin,
        y: pageCtx.height - 30,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.regular,
        color: PDF_COLORS.black
      });
      pageCtx.y = pageCtx.height - pageCtx.topMargin - 20;
    };

    // Helper: draw a drawLabelValue that wraps long values
    const drawFieldWrapped = (label: string, value: string | null | undefined) => {
      if (!value) return;
      const cleanVal = clean(value);
      if (!cleanVal) return;

      const upperLabel = label.toUpperCase() + ':';
      const valueX = LEFT + labelWidth;
      const valueMaxW = RIGHT - valueX;

      if (fonts.regular.widthOfTextAtSize(cleanVal, PDF_TYPOGRAPHY.bodySize) <= valueMaxW) {
        ctx.y = drawLabelValue(ctx.currentPage, upperLabel, cleanVal, {
          x: LEFT, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
        });
      } else {
        // Value too long — use drawLabelValue for label, then wrap value below
        ctx.y = drawLabelValue(ctx.currentPage, upperLabel, '', {
          x: LEFT, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
        });
        drawWrappedText(ctx, cleanVal, {
          fontSize: PDF_TYPOGRAPHY.bodySize,
          color: PDF_COLORS.black,
          lineHeight,
          onNewPage
        });
      }
    };

    // Helper: draw a bullet list
    const drawBulletList = (items: string[]) => {
      for (const item of items) {
        const text = sanitize(`- ${item.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`);
        ensureSpace(ctx, lineHeight, onNewPage);
        ctx.currentPage.drawText(text, {
          x: LEFT + PDF_SPACING.indent,
          y: ctx.y,
          size: PDF_TYPOGRAPHY.bodySize,
          font: fonts.regular,
          color: PDF_COLORS.black
        });
        ctx.y -= lineHeight;
      }
    };

    // Helper: draw Yes/No field
    const drawBoolField = (label: string, value: boolean | undefined) => {
      if (value === undefined || value === null) return;
      const indicator = value ? 'Yes' : 'No';
      ctx.y = drawLabelValue(ctx.currentPage, label.toUpperCase() + ':', indicator, {
        x: LEFT, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
      });
    };

    // =========================================================
    // HEADER
    // =========================================================

    ctx.y = await drawPdfDocumentHeader({
      page: ctx.currentPage,
      pdfDoc,
      fonts,
      startY: ctx.y,
      leftMargin: LEFT,
      rightMargin: RIGHT,
      title: 'INTAKE'
    });

    // =========================================================
    // TWO-COLUMN INFO: PREPARED FOR / INTAKE DETAILS
    // =========================================================

    const leftLines: Array<{ text: string; bold?: boolean }> = [];
    if (intakeData.clientInfo.companyName) {
      leftLines.push({ text: clean(intakeData.clientInfo.companyName), bold: true });
      leftLines.push({ text: clean(intakeData.clientInfo.name) });
    } else {
      leftLines.push({ text: clean(intakeData.clientInfo.name), bold: true });
    }
    leftLines.push({ text: intakeData.clientInfo.email });
    if (intakeData.clientInfo.phone) {
      leftLines.push({ text: clean(intakeData.clientInfo.phone) });
    }

    const rightPairs: Array<{ label: string; value: string }> = [
      { label: 'PROJECT TYPE:', value: formatProjectType(intakeData.projectDetails.type) },
      { label: 'BUDGET:', value: formatBudget(intakeData.projectDetails.budget) },
      { label: 'TIMELINE:', value: formatTimeline(intakeData.projectDetails.targetLaunchDate || intakeData.projectDetails.timeline) },
      { label: 'DATE:', value: formatDate(intakeData.submittedAt) }
    ];

    ctx.y = drawTwoColumnInfo(ctx.currentPage, {
      leftMargin: LEFT,
      rightMargin: RIGHT,
      width: PAGE_W,
      y: ctx.y,
      fonts,
      left: { label: 'PREPARED FOR:', lines: leftLines },
      right: { pairs: rightPairs }
    });

    // =========================================================
    // PROJECT DETAILS
    // =========================================================

    ctx.y -= PDF_SPACING.sectionSpacing;
    ensureSpace(ctx, 100, onNewPage);
    ctx.y = drawSectionLabel(ctx.currentPage, 'PROJECT DETAILS', {
      x: LEFT, y: ctx.y, font: fonts.bold
    });

    drawFieldWrapped('Project Name', intakeData.projectName);

    if (intakeData.projectDetails.targetAudience) {
      drawFieldWrapped('Target Audience', intakeData.projectDetails.targetAudience);
    }
    if (intakeData.projectDetails.designLevel) {
      drawFieldWrapped('Design Level', intakeData.projectDetails.designLevel);
    }

    // Description
    if (intakeData.projectDetails.description) {
      ctx.y = drawLabelValue(ctx.currentPage, 'DESCRIPTION:', '', {
        x: LEFT, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
      });
      drawWrappedText(ctx, clean(intakeData.projectDetails.description), {
        fontSize: PDF_TYPOGRAPHY.bodySize,
        color: PDF_COLORS.black,
        lineHeight,
        onNewPage
      });
    }

    // Requested features
    const features = intakeData.requirements?.features?.length
      ? intakeData.requirements.features
      : intakeData.projectDetails.features;

    if (features && features.length > 0) {
      ctx.y -= 8;
      ctx.y = drawLabelValue(ctx.currentPage, 'REQUESTED FEATURES:', '', {
        x: LEFT, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
      });
      drawBulletList(features);
    }

    // =========================================================
    // DESIGN PREFERENCES
    // =========================================================

    const hasDesignInfo = intakeData.requirements && (
      intakeData.requirements.designStyle ||
      intakeData.requirements.colorPreferences ||
      intakeData.requirements.brandGuidelines !== undefined ||
      intakeData.requirements.contentReady !== undefined
    );

    if (hasDesignInfo) {
      ctx.y -= PDF_SPACING.sectionSpacing;
      ensureSpace(ctx, 80, onNewPage);
      ctx.y = drawSectionLabel(ctx.currentPage, 'DESIGN PREFERENCES', {
        x: LEFT, y: ctx.y, font: fonts.bold
      });

      drawFieldWrapped('Design Style', intakeData.requirements!.designStyle);
      drawFieldWrapped('Color Preferences', intakeData.requirements!.colorPreferences);
      drawBoolField('Brand Guidelines Provided', intakeData.requirements!.brandGuidelines);
      drawBoolField('Content Ready', intakeData.requirements!.contentReady);
    }

    // =========================================================
    // TECHNICAL DETAILS
    // =========================================================

    const hasTechInfo = intakeData.technicalInfo && (
      intakeData.technicalInfo.techComfort ||
      intakeData.technicalInfo.domainHosting
    );

    if (hasTechInfo) {
      ctx.y -= PDF_SPACING.sectionSpacing;
      ensureSpace(ctx, 80, onNewPage);
      ctx.y = drawSectionLabel(ctx.currentPage, 'TECHNICAL DETAILS', {
        x: LEFT, y: ctx.y, font: fonts.bold
      });

      drawFieldWrapped('Technical Comfort', intakeData.technicalInfo!.techComfort);
      drawFieldWrapped('Domain / Hosting', intakeData.technicalInfo!.domainHosting);
    }

    // =========================================================
    // INTEGRATIONS & NOTES
    // =========================================================

    const hasReqExtras = intakeData.requirements && (
      intakeData.requirements.integrations ||
      intakeData.requirements.additionalNotes
    );

    if (hasReqExtras) {
      ctx.y -= PDF_SPACING.sectionSpacing;
      ensureSpace(ctx, 80, onNewPage);
      ctx.y = drawSectionLabel(ctx.currentPage, 'REQUIREMENTS & NOTES', {
        x: LEFT, y: ctx.y, font: fonts.bold
      });

      drawFieldWrapped('Integrations', intakeData.requirements!.integrations);
      drawFieldWrapped('Additional Notes', intakeData.requirements!.additionalNotes);
    }

    if (intakeData.additionalInfo) {
      ctx.y -= PDF_SPACING.sectionSpacing;
      ensureSpace(ctx, 80, onNewPage);
      ctx.y = drawSectionLabel(ctx.currentPage, 'ADDITIONAL INFORMATION', {
        x: LEFT, y: ctx.y, font: fonts.bold
      });

      drawWrappedText(ctx, clean(intakeData.additionalInfo), {
        fontSize: PDF_TYPOGRAPHY.bodySize,
        color: PDF_COLORS.black,
        lineHeight,
        onNewPage
      });
    }

    // =========================================================
    // ASSETS
    // =========================================================

    const hasAssets = intakeData.assets && (
      intakeData.assets.logoProvided !== undefined ||
      intakeData.assets.existingAssets ||
      intakeData.assets.contentAccess
    );

    if (hasAssets) {
      ctx.y -= PDF_SPACING.sectionSpacing;
      ensureSpace(ctx, 80, onNewPage);
      ctx.y = drawSectionLabel(ctx.currentPage, 'ASSETS & RESOURCES', {
        x: LEFT, y: ctx.y, font: fonts.bold
      });

      drawBoolField('Logo Provided', intakeData.assets!.logoProvided);
      drawFieldWrapped('Existing Assets', intakeData.assets!.existingAssets);
      drawFieldWrapped('Content Access', intakeData.assets!.contentAccess);
    }

    // =========================================================
    // FOOTER ON ALL PAGES + PAGE NUMBERS
    // =========================================================

    for (const footerPage of pdfDoc.getPages()) {
      drawPdfFooter(footerPage, {
        leftMargin: LEFT,
        rightMargin: RIGHT,
        width: PAGE_W,
        fonts,
        thankYouText: 'Thank you for your business!'
      });
    }

    await addPageNumbers(pdfDoc);

    // =========================================================
    // GENERATE & SEND
    // =========================================================

    const pdfBytes = await pdfDoc.save();

    cachePdf(
      cacheKey,
      pdfBytes,
      getString(intakeFileRecord, 'updated_at') || getString(intakeFileRecord, 'created_at')
    );

    const clientOrCompany = getString(p, 'company_name') || getString(p, 'client_name');
    const safeClientName = clientOrCompany
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);

    sendPdfResponse(res, pdfBytes, {
      filename: `nobhadcodes_intake_${safeClientName}.pdf`,
      disposition: 'inline',
      cacheStatus: 'MISS'
    });
  })
);

export default router;
