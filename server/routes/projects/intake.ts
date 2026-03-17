import express, { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument as PDFLibDocument, PDFPage, StandardFonts } from 'pdf-lib';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject } from '../../utils/access-control.js';
import { getString } from '../../database/row-helpers.js';
import { BUSINESS_INFO } from '../../config/business.js';
import { PDF_COLORS } from '../../config/pdf-styles.js';
import { getPdfCacheKey, getCachedPdf, cachePdf, drawPdfFooter, drawPdfDocumentHeader } from '../../utils/pdf-utils.js';
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

    const PAGE_W = 612;
    const PAGE_H = 792;
    const LEFT = 54;
    const RIGHT = PAGE_W - 54;
    const CONTENT_W = RIGHT - LEFT;
    const FOOTER_Y = 72;
    const BODY_BOTTOM = FOOTER_Y + 20; // minimum y before needing a new page

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const black = PDF_COLORS.black;
    const dimGray = PDF_COLORS.black;
    const lightGray = PDF_COLORS.black;
    const lineGray = PDF_COLORS.dividerLight;

    // =========================================================
    // MULTI-PAGE STATE
    // =========================================================

    let currentPage: PDFPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - 43;
    let pageNumber = 1;

    const drawFooterOnPage = (pg: PDFPage) => {
      drawPdfFooter(pg, {
        leftMargin: LEFT,
        rightMargin: RIGHT,
        width: PAGE_W,
        fonts: { regular: helvetica, bold: helveticaBold },
        thankYouText: 'Thank you for your business!'
      });
    };

    const addPage = () => {
      drawFooterOnPage(currentPage);
      pageNumber += 1;
      currentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 54;
    };

    const ensureSpace = (needed: number) => {
      if (y - needed < BODY_BOTTOM) {
        addPage();
      }
    };

    // =========================================================
    // DRAW HELPERS
    // =========================================================

    const drawSectionHeading = (title: string) => {
      ensureSpace(30);
      const headingText = title.toUpperCase();
      currentPage.drawText(headingText, {
        x: LEFT,
        y,
        size: 10,
        font: helveticaBold,
        color: black
      });
      const headingW = helveticaBold.widthOfTextAtSize(headingText, 10);
      currentPage.drawLine({
        start: { x: LEFT, y: y - 4 },
        end: { x: LEFT + headingW, y: y - 4 },
        thickness: 0.5,
        color: PDF_COLORS.black
      });
      y -= 20;
    };

    const drawDivider = (gap = 18) => {
      ensureSpace(gap + 4);
      currentPage.drawLine({
        start: { x: LEFT, y: y + gap / 2 },
        end: { x: RIGHT, y: y + gap / 2 },
        thickness: 0.5,
        color: PDF_COLORS.dividerVeryLight
      });
      y -= gap;
    };

    // Draws "Label: " bold + value normal on one line; wraps long values
    const drawField = (label: string, value: string | null | undefined, gap = 16) => {
      if (!value) return;
      const cleanVal = clean(value);
      if (!cleanVal) return;

      const labelText = `${label}: `;
      const labelW = helveticaBold.widthOfTextAtSize(labelText, 10);
      const valueX = LEFT + labelW;
      const valueMaxW = RIGHT - valueX;

      if (helvetica.widthOfTextAtSize(cleanVal, 10) <= valueMaxW) {
        ensureSpace(gap);
        currentPage.drawText(labelText, { x: LEFT, y, size: 10, font: helveticaBold, color: black });
        currentPage.drawText(cleanVal, { x: valueX, y, size: 10, font: helvetica, color: black });
        y -= gap;
      } else {
        // Value too long — put label on its own line, value indented below
        ensureSpace(gap);
        currentPage.drawText(labelText, { x: LEFT, y, size: 10, font: helveticaBold, color: black });
        y -= 14;
        // Wrap the value
        const words = cleanVal.split(' ');
        let line = '';
        for (const word of words) {
          const test = line + (line ? ' ' : '') + word;
          if (helvetica.widthOfTextAtSize(test, 10) > CONTENT_W - 8 && line) {
            ensureSpace(14);
            currentPage.drawText(line, { x: LEFT + 8, y, size: 10, font: helvetica, color: black });
            y -= 14;
            line = word;
          } else {
            line = test;
          }
        }
        if (line) {
          ensureSpace(14);
          currentPage.drawText(line, { x: LEFT + 8, y, size: 10, font: helvetica, color: black });
          y -= 14;
        }
        y -= 2;
      }
    };

    // Draws wrapped body text (no label)
    const drawWrappedText = (text: string, afterGap = 15) => {
      const words = clean(text).split(' ');
      let line = '';
      for (const word of words) {
        const test = line + (line ? ' ' : '') + word;
        if (helvetica.widthOfTextAtSize(test, 10) > CONTENT_W && line) {
          ensureSpace(14);
          currentPage.drawText(line, { x: LEFT, y, size: 10, font: helvetica, color: black });
          y -= 14;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) {
        ensureSpace(14);
        currentPage.drawText(line, { x: LEFT, y, size: 10, font: helvetica, color: black });
        y -= 14;
      }
      y -= afterGap;
    };

    // Draws a bullet list
    const drawBulletList = (items: string[], afterGap = 10) => {
      for (const item of items) {
        const text = sanitize(`•  ${item.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`);
        ensureSpace(14);
        currentPage.drawText(text, { x: LEFT, y, size: 10, font: helvetica, color: black });
        y -= 14;
      }
      y -= afterGap;
    };

    // Draws a Yes/No checkbox-style indicator
    const drawBoolField = (label: string, value: boolean | undefined) => {
      if (value === undefined || value === null) return;
      ensureSpace(16);
      const indicator = value ? 'Yes' : 'No';
      const labelText = `${label}: `;
      const labelW = helveticaBold.widthOfTextAtSize(labelText, 10);
      currentPage.drawText(labelText, { x: LEFT, y, size: 10, font: helveticaBold, color: black });
      currentPage.drawText(indicator, { x: LEFT + labelW, y, size: 10, font: helvetica, color: black });
      y -= 16;
    };

    // =========================================================
    // PAGE 1 HEADER — shared across all PDF types
    // =========================================================

    y = await drawPdfDocumentHeader({
      page: currentPage,
      pdfDoc,
      fonts: { regular: helvetica, bold: helveticaBold },
      startY: y,
      leftMargin: LEFT,
      rightMargin: RIGHT,
      title: 'INTAKE'
    });

    // =========================================================
    // PREPARED FOR + DATE/PROJECT #
    // =========================================================

    const detailsX = PAGE_W / 2 + 36;

    const preparedForLabel = 'PREPARED FOR:';
    currentPage.drawText(preparedForLabel, {
      x: LEFT, y,
      size: 10, font: helveticaBold, color: PDF_COLORS.black
    });
    const preparedForW = helveticaBold.widthOfTextAtSize(preparedForLabel, 10);
    currentPage.drawLine({
      start: { x: LEFT, y: y - 4 },
      end: { x: LEFT + preparedForW, y: y - 4 },
      thickness: 0.5,
      color: PDF_COLORS.black
    });

    currentPage.drawText(clean(intakeData.clientInfo.name), {
      x: LEFT, y: y - 14,
      size: 10, font: helveticaBold, color: black
    });

    let clientLineY = y - 25;
    if (intakeData.clientInfo.companyName) {
      currentPage.drawText(clean(intakeData.clientInfo.companyName), {
        x: LEFT, y: clientLineY,
        size: 10, font: helvetica, color: black
      });
      clientLineY -= 12;
    }

    currentPage.drawText(intakeData.clientInfo.email, {
      x: LEFT, y: clientLineY,
      size: 10, font: helvetica, color: dimGray
    });
    clientLineY -= 12;

    if (intakeData.clientInfo.phone) {
      currentPage.drawText(clean(intakeData.clientInfo.phone), {
        x: LEFT, y: clientLineY,
        size: 10, font: helvetica, color: dimGray
      });
      clientLineY -= 12;
    }

    const preferredContact = intakeData.clientInfo.preferredContact
      || intakeData.clientInfo.preferredContactMethod;
    if (preferredContact) {
      const contactLabel = `Preferred: ${formatContact(preferredContact)}`;
      currentPage.drawText(contactLabel, {
        x: LEFT, y: clientLineY,
        size: 9, font: helvetica, color: lightGray
      });
      clientLineY -= 12;
    }

    if (intakeData.clientInfo.companyWebsite) {
      currentPage.drawText(clean(intakeData.clientInfo.companyWebsite), {
        x: LEFT, y: clientLineY,
        size: 9, font: helvetica, color: lightGray
      });
      clientLineY -= 12;
    }

    if (intakeData.clientInfo.timezone) {
      currentPage.drawText(clean(intakeData.clientInfo.timezone), {
        x: LEFT, y: clientLineY,
        size: 9, font: helvetica, color: lightGray
      });
    }

    // Right side — DATE + PROJECT #
    currentPage.drawText('DATE:', {
      x: detailsX, y,
      size: 9, font: helveticaBold, color: dimGray
    });
    const dateVal = formatDate(intakeData.submittedAt);
    currentPage.drawText(dateVal, {
      x: RIGHT - helvetica.widthOfTextAtSize(dateVal, 9),
      y,
      size: 9, font: helvetica, color: black
    });

    currentPage.drawText('PROJECT #:', {
      x: detailsX, y: y - 14,
      size: 9, font: helveticaBold, color: dimGray
    });
    const projIdText = `#${intakeData.projectId}`;
    currentPage.drawText(projIdText, {
      x: RIGHT - helvetica.widthOfTextAtSize(projIdText, 9),
      y: y - 14,
      size: 9, font: helvetica, color: black
    });

    // Advance past the tallest possible client block
    y = Math.min(y - 72, clientLineY - 20);
    drawDivider(18);

    // =========================================================
    // PROJECT DETAILS
    // =========================================================

    drawSectionHeading('Project Details');

    drawField('Project Name', intakeData.projectName);
    drawField('Project Type', formatProjectType(intakeData.projectDetails.type));

    const timeline = intakeData.projectDetails.targetLaunchDate
      || intakeData.projectDetails.timeline;
    if (timeline) drawField('Timeline', formatTimeline(timeline));

    const budget = intakeData.projectDetails.budget;
    if (budget) drawField('Budget', formatBudget(budget));

    if (intakeData.projectDetails.targetAudience) {
      drawField('Target Audience', intakeData.projectDetails.targetAudience);
    }

    if (intakeData.projectDetails.designLevel) {
      drawField('Design Level', intakeData.projectDetails.designLevel);
    }

    y -= 10;

    // =========================================================
    // PROJECT DESCRIPTION
    // =========================================================

    drawSectionHeading('Project Description');
    drawWrappedText(
      intakeData.projectDetails.description || 'No description provided',
      15
    );

    // =========================================================
    // REQUESTED FEATURES (from projectDetails or requirements)
    // =========================================================

    const features = intakeData.requirements?.features?.length
      ? intakeData.requirements.features
      : intakeData.projectDetails.features;

    if (features && features.length > 0) {
      drawSectionHeading('Requested Features');
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
      drawSectionHeading('Design Preferences');
      drawField('Design Style', intakeData.requirements!.designStyle);
      drawField('Color Preferences', intakeData.requirements!.colorPreferences);
      drawBoolField('Brand Guidelines Provided', intakeData.requirements!.brandGuidelines);
      drawBoolField('Content Ready', intakeData.requirements!.contentReady);
      y -= 6;
    }

    // =========================================================
    // TECHNICAL INFORMATION
    // =========================================================

    const hasTechInfo = intakeData.technicalInfo && (
      intakeData.technicalInfo.techComfort ||
      intakeData.technicalInfo.domainHosting
    );

    if (hasTechInfo) {
      drawSectionHeading('Technical Information');
      drawField('Technical Comfort', intakeData.technicalInfo!.techComfort);
      drawField('Domain / Hosting', intakeData.technicalInfo!.domainHosting);
      y -= 6;
    }

    // =========================================================
    // INTEGRATIONS & ADDITIONAL NOTES
    // =========================================================

    const hasReqExtras = intakeData.requirements && (
      intakeData.requirements.integrations ||
      intakeData.requirements.additionalNotes
    );

    if (hasReqExtras) {
      drawSectionHeading('Requirements & Notes');
      if (intakeData.requirements!.integrations) {
        ensureSpace(16);
        currentPage.drawText('Third-party Integrations: ', {
          x: LEFT, y, size: 10, font: helveticaBold, color: black
        });
        y -= 14;
        drawWrappedText(intakeData.requirements!.integrations, 10);
      }
      if (intakeData.requirements!.additionalNotes) {
        ensureSpace(16);
        currentPage.drawText('Additional Notes: ', {
          x: LEFT, y, size: 10, font: helveticaBold, color: black
        });
        y -= 14;
        drawWrappedText(intakeData.requirements!.additionalNotes, 10);
      }
    }

    if (intakeData.additionalInfo) {
      drawSectionHeading('Additional Information');
      drawWrappedText(intakeData.additionalInfo);
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
      drawSectionHeading('Assets & Resources');
      drawBoolField('Logo Provided', intakeData.assets!.logoProvided);
      if (intakeData.assets!.existingAssets) {
        ensureSpace(16);
        currentPage.drawText('Existing Assets: ', {
          x: LEFT, y, size: 10, font: helveticaBold, color: black
        });
        y -= 14;
        drawWrappedText(intakeData.assets!.existingAssets, 10);
      }
      if (intakeData.assets!.contentAccess) {
        ensureSpace(16);
        currentPage.drawText('Content & Access Details: ', {
          x: LEFT, y, size: 10, font: helveticaBold, color: black
        });
        y -= 14;
        drawWrappedText(intakeData.assets!.contentAccess, 10);
      }
    }

    // =========================================================
    // FOOTER ON LAST PAGE
    // =========================================================

    drawFooterOnPage(currentPage);

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
