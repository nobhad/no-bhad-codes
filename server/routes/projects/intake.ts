import express, { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument as PDFLibDocument, StandardFonts, rgb } from 'pdf-lib';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject } from '../../middleware/access-control.js';
import { getString, getNumber } from '../../database/row-helpers.js';
import { BUSINESS_INFO, getPdfLogoBytes } from '../../config/business.js';
import { getPdfCacheKey, getCachedPdf, cachePdf } from '../../utils/pdf-utils.js';
import { errorResponse } from '../../utils/api-response.js';
import { sendPdfResponse } from '../../utils/pdf-generator.js';

const router = express.Router();

interface IntakeDocument {
  submittedAt: string;
  projectId: number;
  projectName: string;
  createdBy?: string;
  clientInfo: {
    name: string;
    email: string;
    projectFor?: string;
    companyName?: string | null;
  };
  projectDetails: {
    type: string;
    description: string;
    timeline: string;
    budget: string;
    features?: string[];
    designLevel?: string | null;
  };
  technicalInfo?: {
    techComfort?: string | null;
    domainHosting?: string | null;
  };
  additionalInfo?: string | null;
}

/**
 * GET /api/projects/:id/intake/pdf
 * Generate a branded PDF from the project's intake form using pdf-lib
 */
router.get(
  '/:id/intake/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    // Get project with client info
    const project = await db.get(
      `SELECT p.*, c.contact_name as client_name, c.email as client_email, c.company_name
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );

    if (!project) {
      return errorResponse(res, 'Project not found', 404);
    }

    const p = project as Record<string, unknown>;

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    // Find the intake file for this project
    const intakeFile = await db.get(
      `SELECT * FROM files
       WHERE project_id = ?
       AND (original_filename LIKE '%intake%' OR filename LIKE 'intake_%' OR filename LIKE 'admin_project_%' OR filename LIKE 'project_intake_%' OR filename LIKE 'nobhadcodes_intake_%')
       AND mime_type = 'application/json'
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId]
    );

    if (!intakeFile) {
      return errorResponse(res, 'Intake form not found for this project', 404);
    }

    // Check cache first (use intake file's updated_at for freshness)
    const intakeFileRecord = intakeFile as Record<string, unknown>;
    const cacheKey = getPdfCacheKey('intake', projectId, getString(intakeFileRecord, 'updated_at') || getString(intakeFileRecord, 'created_at'));
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
      return errorResponse(res, 'Intake file not found on disk', 404);
    }

    let intakeData: IntakeDocument;
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      intakeData = JSON.parse(fileContent);
    } catch {
      return errorResponse(res, 'Failed to read intake file', 500);
    }

    // Helper functions
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
      const timelineMap: Record<string, string> = {
        'asap': 'As Soon As Possible',
        '1-month': '1 Month',
        '1-3-months': '1-3 Months',
        '3-6-months': '3-6 Months',
        'flexible': 'Flexible'
      };
      return timelineMap[timeline] || timeline;
    };

    const formatBudget = (budget: string): string => {
      const budgetMap: Record<string, string> = {
        'under-2k': 'Under $2,000',
        '2k-5k': '$2,000 - $5,000',
        '2.5k-5k': '$2,500 - $5,000',
        '5k-10k': '$5,000 - $10,000',
        '10k-25k': '$10,000 - $25,000',
        '25k+': '$25,000+'
      };
      return budgetMap[budget] || budget;
    };

    const formatProjectType = (type: string): string => {
      const typeMap: Record<string, string> = {
        'simple-site': 'Simple Website',
        'business-site': 'Business Website',
        'portfolio': 'Portfolio Website',
        'e-commerce': 'E-commerce Store',
        'ecommerce': 'E-commerce Store',
        'web-app': 'Web Application',
        'browser-extension': 'Browser Extension',
        'other': 'Custom Project'
      };
      return typeMap[type] || type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const decodeHtml = (text: string): string => {
      return text
        .replace(/&amp;/g, '&')
        .replace(/&#x2F;/g, '/')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    };

    // Create PDF document using pdf-lib
    const pdfDoc = await PDFLibDocument.create();

    // Set PDF metadata for proper title in browser tab
    const pdfClientName = getString(p, 'company_name') || getString(p, 'client_name') || 'Client';
    const pdfTitle = `NoBhadCodes Intake - ${pdfClientName}`;
    pdfDoc.setTitle(pdfTitle);
    pdfDoc.setAuthor(BUSINESS_INFO.name);
    pdfDoc.setSubject('Project Intake Form');
    pdfDoc.setCreator('NoBhadCodes');

    const page = pdfDoc.addPage([612, 792]); // LETTER size
    const { width, height } = page.getSize();

    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const black = rgb(0, 0, 0);
    const lightGray = rgb(0.5, 0.5, 0.5);
    const lineGray = rgb(0.8, 0.8, 0.8);

    // Layout constants (matching template: 0.75 inch margins)
    const leftMargin = 54; // 0.75 inch
    const rightMargin = width - 54;
    const contentWidth = rightMargin - leftMargin;

    // pdf-lib uses bottom-left origin, so we work from top down
    // Y position decreases as we go down the page
    let y = height - 43; // Start ~0.6 inch from top (matching template)

    // === HEADER - Title on left, logo and business info on right ===
    const logoHeight = 100;

    // INTAKE title on left: 28pt
    const titleText = 'INTAKE';
    page.drawText(titleText, {
      x: leftMargin,
      y: y - 20,
      size: 28,
      font: helveticaBold,
      color: rgb(0.15, 0.15, 0.15)
    });

    // Logo and business info on right (logo left of text, text left-aligned)
    let textStartX = rightMargin - 180;
    const intakeLogoBytes = getPdfLogoBytes();
    if (intakeLogoBytes) {
      const logoImage = await pdfDoc.embedPng(intakeLogoBytes);
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

    // === DIVIDER LINE ===
    page.drawLine({
      start: { x: leftMargin, y: y },
      end: { x: rightMargin, y: y },
      thickness: 1,
      color: lineGray
    });
    y -= 21; // 0.3 inch gap

    // === PREPARED FOR (left) and DATE/PROJECT (right) ===
    const detailsX = width / 2 + 36; // Middle + 0.5 inch

    // Left side - PREPARED FOR:
    page.drawText('PREPARED FOR:', {
      x: leftMargin,
      y: y,
      size: 11,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    });

    // Client name (bold)
    page.drawText(decodeHtml(intakeData.clientInfo.name), {
      x: leftMargin,
      y: y - 14,
      size: 10,
      font: helveticaBold,
      color: black
    });

    // Company name (if exists)
    let clientLineY = y - 25;
    if (intakeData.clientInfo.companyName) {
      page.drawText(decodeHtml(intakeData.clientInfo.companyName), {
        x: leftMargin,
        y: clientLineY,
        size: 10,
        font: helvetica,
        color: black
      });
      clientLineY -= 11;
    }

    // Email
    page.drawText(intakeData.clientInfo.email, {
      x: leftMargin,
      y: clientLineY,
      size: 10,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3)
    });

    // Right side - DATE:
    page.drawText('DATE:', {
      x: detailsX,
      y: y,
      size: 9,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3)
    });
    page.drawText(formatDate(intakeData.submittedAt), {
      x: rightMargin - helvetica.widthOfTextAtSize(formatDate(intakeData.submittedAt), 9),
      y: y,
      size: 9,
      font: helvetica,
      color: black
    });

    // PROJECT #:
    page.drawText('PROJECT #:', {
      x: detailsX,
      y: y - 14,
      size: 9,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3)
    });
    const projectIdText = `#${intakeData.projectId}`;
    page.drawText(projectIdText, {
      x: rightMargin - helvetica.widthOfTextAtSize(projectIdText, 9),
      y: y - 14,
      size: 9,
      font: helvetica,
      color: black
    });

    y -= 72; // Move past client info section (1.0 inch)

    // === CONTENT AREA SEPARATOR (light line) ===
    page.drawLine({
      start: { x: leftMargin, y: y },
      end: { x: rightMargin, y: y },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9)
    });
    y -= 21;

    // Helper to sanitize text for PDF (remove newlines and special chars)
    const sanitizeForPdf = (text: string): string => {
      return text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    };

    // === PROJECT DETAILS ===
    page.drawText('Project Details', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: black });
    y -= 20;

    // Project Name
    page.drawText('Project Name: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const nameX = leftMargin + helveticaBold.widthOfTextAtSize('Project Name: ', 10);
    page.drawText(sanitizeForPdf(decodeHtml(intakeData.projectName)), { x: nameX, y: y, size: 10, font: helvetica, color: black });
    y -= 16;

    // Project Type
    page.drawText('Project Type: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const typeX = leftMargin + helveticaBold.widthOfTextAtSize('Project Type: ', 10);
    page.drawText(sanitizeForPdf(formatProjectType(intakeData.projectDetails.type)), { x: typeX, y: y, size: 10, font: helvetica, color: black });
    y -= 16;

    // Timeline
    page.drawText('Timeline: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const timelineX = leftMargin + helveticaBold.widthOfTextAtSize('Timeline: ', 10);
    page.drawText(sanitizeForPdf(formatTimeline(intakeData.projectDetails.timeline)), { x: timelineX, y: y, size: 10, font: helvetica, color: black });
    y -= 16;

    // Budget
    page.drawText('Budget: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
    const budgetX = leftMargin + helveticaBold.widthOfTextAtSize('Budget: ', 10);
    page.drawText(sanitizeForPdf(formatBudget(intakeData.projectDetails.budget)), { x: budgetX, y: y, size: 10, font: helvetica, color: black });
    y -= 30;

    // === PROJECT DESCRIPTION ===
    page.drawText('Project Description', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: black });
    y -= 18;

    // Word wrap description text
    const description = sanitizeForPdf(decodeHtml(intakeData.projectDetails.description || 'No description provided'));
    const words = description.split(' ');
    let line = '';
    const maxWidth = contentWidth;
    const lineHeight = 14;

    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const testWidth = helvetica.widthOfTextAtSize(testLine, 10);
      if (testWidth > maxWidth && line) {
        page.drawText(line, { x: leftMargin, y: y, size: 10, font: helvetica, color: black });
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: leftMargin, y: y, size: 10, font: helvetica, color: black });
      y -= lineHeight;
    }
    y -= 15;

    // === FEATURES (if any) ===
    if (intakeData.projectDetails.features && intakeData.projectDetails.features.length > 0) {
      page.drawText('Requested Features', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: black });
      y -= 18;

      for (const feature of intakeData.projectDetails.features) {
        const featureText = sanitizeForPdf(decodeHtml(`•  ${feature.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`));
        page.drawText(featureText, { x: leftMargin, y: y, size: 10, font: helvetica, color: black });
        y -= 14;
      }
      y -= 10;
    }

    // === TECHNICAL INFO (if any) ===
    if (intakeData.technicalInfo && (intakeData.technicalInfo.techComfort || intakeData.technicalInfo.domainHosting)) {
      page.drawText('Technical Information', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: black });
      y -= 18;

      if (intakeData.technicalInfo.techComfort) {
        page.drawText('Technical Comfort: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
        const tcX = leftMargin + helveticaBold.widthOfTextAtSize('Technical Comfort: ', 10);
        page.drawText(sanitizeForPdf(decodeHtml(intakeData.technicalInfo.techComfort)), { x: tcX, y: y, size: 10, font: helvetica, color: black });
        y -= 14;
      }
      if (intakeData.technicalInfo.domainHosting) {
        page.drawText('Domain/Hosting: ', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: black });
        const dhX = leftMargin + helveticaBold.widthOfTextAtSize('Domain/Hosting: ', 10);
        page.drawText(sanitizeForPdf(decodeHtml(intakeData.technicalInfo.domainHosting)), { x: dhX, y: y, size: 10, font: helvetica, color: black });
        y -= 14;
      }
    }

    // === FOOTER - always at bottom of page 1 ===
    // Footer separator line
    page.drawLine({
      start: { x: leftMargin, y: 72 }, // 1 inch from bottom
      end: { x: rightMargin, y: 72 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    });

    // Footer contact info (centered with bullet separators)
    const footerText = `${BUSINESS_INFO.name} • ${BUSINESS_INFO.owner} • ${BUSINESS_INFO.email} • ${BUSINESS_INFO.website}`;
    const footerWidth = helvetica.widthOfTextAtSize(footerText, 7);
    page.drawText(footerText, {
      x: (width - footerWidth) / 2,
      y: 36, // 0.5 inch from bottom
      size: 7,
      font: helvetica,
      color: lightGray
    });

    // Generate PDF bytes and send response
    const pdfBytes = await pdfDoc.save();

    // Cache the generated PDF
    cachePdf(cacheKey, pdfBytes, getString(intakeFileRecord, 'updated_at') || getString(intakeFileRecord, 'created_at'));

    // Generate descriptive PDF filename with NoBhadCodes branding
    // Use company name if available, otherwise client name
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
