/**
 * ===============================================
 * CHECKLIST PDF ROUTES (Admin)
 * ===============================================
 * @file server/routes/admin/checklist-pdf.ts
 *
 * Endpoints for generating client checklist PDFs.
 *
 * GET  /api/admin/checklist-pdf/:clientId          — Auto-generate from DB
 * POST /api/admin/checklist-pdf/from-json           — Generate from JSON data
 * POST /api/admin/checklist-pdf/from-template        — Generate from built-in template
 * GET  /api/admin/checklist-pdf/templates            — List available templates
 */

import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { checklistPdfService } from '../../services/checklist-pdf-service.js';
import { CHECKLIST_TEMPLATES } from '../../services/checklist-pdf-types.js';
import { errorResponse, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * GET /api/admin/checklist-pdf/templates
 * List available checklist templates.
 */
router.get(
  '/templates',
  authenticateToken,
  requireAdmin,
  (_req: JWTAuthRequest, res: Response) => {
    const templates = Object.entries(CHECKLIST_TEMPLATES).map(([key, t]) => ({
      id: key,
      name: t.name,
      sectionCount: t.sections.length,
      itemCount: t.sections.reduce((sum, s) => sum + s.items.length, 0)
    }));
    res.json({ data: { templates } });
  }
);

/**
 * GET /api/admin/checklist-pdf/:clientId
 * Auto-generate a checklist PDF from the client's pending items in DB.
 * Optional query: ?projectId=N
 */
router.get(
  '/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const clientId = Number(req.params.clientId);
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;

    if (!clientId) {
      errorResponse(res, 'clientId is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const data = await checklistPdfService.buildChecklistFromDb(clientId, projectId);
    const pdfBytes = await checklistPdfService.generateChecklistPdf(data);

    const filename = `NBC_Checklist-${data.clientCompany?.replace(/\s+/g, '_') || data.clientName.replace(/\s+/g, '_')}-${new Date().getFullYear()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  })
);

/**
 * POST /api/admin/checklist-pdf/from-json
 * Generate a checklist PDF from raw JSON data.
 * Body: ChecklistPdfData
 */
router.post(
  '/from-json',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const jsonData = req.body;

    if (!jsonData.clientName || !jsonData.sections) {
      errorResponse(res, 'clientName and sections are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const data = checklistPdfService.buildFromJson(jsonData);
    const pdfBytes = await checklistPdfService.generateChecklistPdf(data);

    const filename = `NBC_Checklist-${data.clientCompany?.replace(/\s+/g, '_') || data.clientName.replace(/\s+/g, '_')}-${new Date().getFullYear()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  })
);

/**
 * POST /api/admin/checklist-pdf/from-template
 * Generate a checklist PDF from a built-in template.
 * Body: { templateName, clientName, clientCompany?, projectName?, overrides? }
 */
router.post(
  '/from-template',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const { templateName, clientName, clientCompany, projectName, overrides } = req.body;

    if (!templateName || !clientName) {
      errorResponse(res, 'templateName and clientName are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const data = checklistPdfService.buildFromTemplate(
      templateName, clientName, clientCompany, projectName, overrides
    );
    const pdfBytes = await checklistPdfService.generateChecklistPdf(data);

    const filename = `NBC_Checklist-${clientCompany?.replace(/\s+/g, '_') || clientName.replace(/\s+/g, '_')}-${new Date().getFullYear()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  })
);

export default router;
