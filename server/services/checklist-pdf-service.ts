/**
 * ===============================================
 * CHECKLIST PDF SERVICE
 * ===============================================
 * @file server/services/checklist-pdf-service.ts
 *
 * Generates branded client checklist/to-do PDFs.
 * Three input modes:
 *   1. Auto-generate from DB (pending items across all systems)
 *   2. Markdown file input
 *   3. JSON input (structured data / templates)
 */

import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';
import { getDatabase } from '../database/init.js';
import { BUSINESS_INFO } from '../config/business.js';
import { PDF_COLORS, PDF_TYPOGRAPHY, PDF_SPACING } from '../config/pdf-styles.js';
import {
  createPdfContext,
  drawPdfDocumentHeader,
  drawPdfFooter,
  ensureSpace,
  type PdfPageContext
} from '../utils/pdf-utils.js';
import type {
  ChecklistPdfData,
  ChecklistSection,
  ChecklistItem
} from './checklist-pdf-types.js';
import { CHECKLIST_TEMPLATES } from './checklist-pdf-types.js';

// ============================================
// Constants
// ============================================

const CHECKBOX_SIZE = 8;
const CHECKBOX_OFFSET_Y = -1;
const ITEM_LINE_HEIGHT = PDF_SPACING.lineHeight;
const SECTION_GAP = PDF_SPACING.sectionSpacing;
const DESCRIPTION_INDENT = 22;
const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'URGENT',
  high: 'HIGH',
  normal: '',
  low: 'LOW'
};

// ============================================
// PDF GENERATION
// ============================================

/**
 * Generate a branded checklist PDF from structured data.
 * Returns raw PDF bytes.
 */
async function generateChecklistPdf(data: ChecklistPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const ctx = await createPdfContext(pdfDoc);

  const totalPages = { count: 1 };

  // --- Header ---
  const afterHeader = await drawPdfDocumentHeader({
    page: ctx.currentPage,
    pdfDoc: ctx.pdfDoc,
    fonts: ctx.fonts,
    startY: ctx.y,
    leftMargin: ctx.leftMargin,
    rightMargin: ctx.rightMargin,
    title: 'CHECKLIST'
  });
  ctx.y = afterHeader;

  // --- Client info line ---
  const clientLine = [data.clientCompany, data.clientName].filter(Boolean).join(' — ');
  if (clientLine) {
    ctx.currentPage.drawText(clientLine, {
      x: ctx.leftMargin,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: ctx.fonts.bold,
      color: PDF_COLORS.black
    });
    ctx.y -= ITEM_LINE_HEIGHT;
  }

  if (data.projectName) {
    ctx.currentPage.drawText(`Project: ${data.projectName}`, {
      x: ctx.leftMargin,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: ctx.fonts.regular,
      color: PDF_COLORS.black
    });
    ctx.y -= ITEM_LINE_HEIGHT;
  }

  ctx.currentPage.drawText(`Generated: ${data.generatedDate}`, {
    x: ctx.leftMargin,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: ctx.fonts.regular,
    color: PDF_COLORS.black
  });
  ctx.y -= ITEM_LINE_HEIGHT + 6;

  // --- Intro text ---
  if (data.introText) {
    const introLines = wrapText(data.introText, ctx.fonts.regular, PDF_TYPOGRAPHY.bodySize, ctx.contentWidth);
    for (const line of introLines) {
      ctx.currentPage.drawText(line, {
        x: ctx.leftMargin,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: ctx.fonts.regular,
        color: PDF_COLORS.black
      });
      ctx.y -= ITEM_LINE_HEIGHT;
    }
    ctx.y -= 6;
  }

  // --- HR ---
  ctx.currentPage.drawLine({
    start: { x: ctx.leftMargin, y: ctx.y },
    end: { x: ctx.rightMargin, y: ctx.y },
    thickness: PDF_SPACING.dividerThickness,
    color: PDF_COLORS.black
  });
  ctx.y -= SECTION_GAP;

  // --- Sections ---
  const onNewPage = (newCtx: PdfPageContext) => {
    totalPages.count++;
    newCtx.y = newCtx.height - newCtx.topMargin - 20;
    newCtx.currentPage.drawText('CHECKLIST (continued)', {
      x: newCtx.leftMargin,
      y: newCtx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: newCtx.fonts.bold,
      color: PDF_COLORS.black
    });
    newCtx.y -= ITEM_LINE_HEIGHT + 10;
  };

  for (const section of data.sections) {
    if (section.items.length === 0) continue;

    // Section heading
    const updatedCtx = ensureSpace(ctx, SECTION_GAP + ITEM_LINE_HEIGHT * 3, onNewPage);
    Object.assign(ctx, updatedCtx);

    ctx.currentPage.drawText(section.title.toUpperCase(), {
      x: ctx.leftMargin,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: ctx.fonts.bold,
      color: PDF_COLORS.black
    });
    ctx.y -= 2;

    // Section underline
    ctx.currentPage.drawLine({
      start: { x: ctx.leftMargin, y: ctx.y },
      end: { x: ctx.rightMargin, y: ctx.y },
      thickness: PDF_SPACING.dividerThin,
      color: PDF_COLORS.black
    });
    ctx.y -= ITEM_LINE_HEIGHT;

    // Items
    for (const item of section.items) {
      const itemHeight = item.description ? ITEM_LINE_HEIGHT * 2.5 : ITEM_LINE_HEIGHT * 1.5;
      const spaceCtx = ensureSpace(ctx, itemHeight, onNewPage);
      Object.assign(ctx, spaceCtx);

      drawChecklistItem(ctx, item);
    }

    ctx.y -= 8; // Gap after section
  }

  // --- Summary stats ---
  const totalItems = data.sections.reduce((sum, s) => sum + s.items.length, 0);
  const completedItems = data.sections.reduce(
    (sum, s) => sum + s.items.filter(i => i.completed).length, 0
  );
  const pendingItems = totalItems - completedItems;

  ctx.y -= 6;
  ctx.currentPage.drawLine({
    start: { x: ctx.leftMargin, y: ctx.y },
    end: { x: ctx.rightMargin, y: ctx.y },
    thickness: PDF_SPACING.dividerThickness,
    color: PDF_COLORS.black
  });
  ctx.y -= ITEM_LINE_HEIGHT + 4;

  const summaryText = `${pendingItems} item${pendingItems !== 1 ? 's' : ''} pending of ${totalItems} total`;
  ctx.currentPage.drawText(summaryText, {
    x: ctx.leftMargin,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: ctx.fonts.bold,
    color: PDF_COLORS.black
  });
  ctx.y -= ITEM_LINE_HEIGHT;

  // Contact line
  ctx.currentPage.drawText(
    `Questions? Reach out to ${BUSINESS_INFO.email}`,
    {
      x: ctx.leftMargin,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: ctx.fonts.regular,
      color: PDF_COLORS.black
    }
  );

  // --- Footer on all pages ---
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    drawPdfFooter(pages[i], {
      leftMargin: ctx.leftMargin,
      rightMargin: ctx.rightMargin,
      width: ctx.width,
      fonts: ctx.fonts
    });
  }

  return pdfDoc.save();
}

// ============================================
// DRAWING HELPERS
// ============================================

function drawChecklistItem(ctx: PdfPageContext, item: ChecklistItem): void {
  const x = ctx.leftMargin;

  // Checkbox
  ctx.currentPage.drawRectangle({
    x,
    y: ctx.y + CHECKBOX_OFFSET_Y,
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderColor: PDF_COLORS.black,
    borderWidth: 0.75,
    color: item.completed ? PDF_COLORS.black : undefined
  });

  // Checkmark for completed items
  if (item.completed) {
    ctx.currentPage.drawText('X', {
      x: x + 1.5,
      y: ctx.y + CHECKBOX_OFFSET_Y + 1,
      size: 7,
      font: ctx.fonts.bold,
      color: PDF_COLORS.white
    });
  }

  // Label
  const labelX = x + CHECKBOX_SIZE + 6;
  const font = item.required === false ? ctx.fonts.regular : ctx.fonts.regular;
  let labelText = item.label;

  // Priority tag
  const priorityLabel = item.priority ? PRIORITY_LABELS[item.priority] : '';
  if (priorityLabel) {
    labelText = `[${priorityLabel}] ${labelText}`;
  }

  // Required indicator
  if (item.required === false) {
    labelText += ' (optional)';
  }

  // Due date
  if (item.dueDate) {
    labelText += ` — due ${item.dueDate}`;
  }

  ctx.currentPage.drawText(labelText, {
    x: labelX,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font,
    color: PDF_COLORS.black
  });
  ctx.y -= ITEM_LINE_HEIGHT;

  // Description (indented, smaller)
  if (item.description) {
    const descLines = wrapText(
      item.description,
      ctx.fonts.regular,
      PDF_TYPOGRAPHY.bodySize - 1,
      ctx.contentWidth - DESCRIPTION_INDENT
    );
    for (const line of descLines) {
      ctx.currentPage.drawText(line, {
        x: labelX + DESCRIPTION_INDENT - CHECKBOX_SIZE,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize - 1,
        font: ctx.fonts.regular,
        color: PDF_COLORS.black
      });
      ctx.y -= ITEM_LINE_HEIGHT - 2;
    }
  }

  ctx.y -= 2; // Small gap between items
}

function wrapText(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ============================================
// AUTO-GENERATE FROM DATABASE
// ============================================

/**
 * Build checklist data by querying all 4 systems for a client's pending items.
 */
async function buildChecklistFromDb(clientId: number, projectId?: number): Promise<ChecklistPdfData> {
  const db = getDatabase();

  // Get client info
  const client = (await db.get(
    'SELECT id, COALESCE(contact_name, company_name) as name, company_name, email FROM clients WHERE id = ?',
    [clientId]
  )) as { id: number; name: string; company_name: string | null; email: string } | undefined;

  if (!client) throw new Error(`Client ${clientId} not found`);

  // Get project info (optional)
  let projectName: string | undefined;
  if (projectId) {
    const project = (await db.get(
      'SELECT project_name FROM projects WHERE id = ?',
      [projectId]
    )) as { project_name: string } | undefined;
    projectName = project?.project_name;
  }

  const sections: ChecklistSection[] = [];

  // 1. Onboarding checklist items
  const onboardingSteps = (await db.all(
    `SELECT os.label, os.description, os.status
     FROM onboarding_steps os
     JOIN onboarding_checklists oc ON os.checklist_id = oc.id
     WHERE oc.client_id = ? AND oc.status = 'active'
     ORDER BY os.step_order ASC`,
    [clientId]
  )) as Array<{ label: string; description: string | null; status: string }>;

  if (onboardingSteps.length > 0) {
    sections.push({
      title: 'Getting Started',
      items: onboardingSteps.map(s => ({
        label: s.label,
        description: s.description || undefined,
        completed: s.status === 'completed',
        required: true
      }))
    });
  }

  // 2. Document requests
  const docQuery = projectId
    ? 'SELECT title, description, status, due_date, is_required, priority FROM document_requests WHERE client_id = ? AND project_id = ? AND status NOT IN (\'approved\', \'cancelled\') AND deleted_at IS NULL ORDER BY priority DESC, due_date ASC'
    : 'SELECT title, description, status, due_date, is_required, priority FROM document_requests WHERE client_id = ? AND status NOT IN (\'approved\', \'cancelled\') AND deleted_at IS NULL ORDER BY priority DESC, due_date ASC';
  const docParams = projectId ? [clientId, projectId] : [clientId];

  const docRequests = (await db.all(docQuery, docParams)) as Array<{
    title: string; description: string | null; status: string;
    due_date: string | null; is_required: number; priority: string;
  }>;

  if (docRequests.length > 0) {
    sections.push({
      title: 'Documents Needed',
      items: docRequests.map(d => ({
        label: d.title,
        description: d.description || undefined,
        completed: d.status === 'uploaded' || d.status === 'approved',
        dueDate: d.due_date || undefined,
        required: d.is_required === 1,
        priority: (d.priority as ChecklistItem['priority']) || 'normal'
      }))
    });
  }

  // 3. Questionnaires
  const questionnaireQuery = projectId
    ? `SELECT q.name, qr.status FROM questionnaire_responses qr
       JOIN questionnaires q ON qr.questionnaire_id = q.id
       WHERE qr.client_id = ? AND qr.project_id = ? AND qr.status != 'completed'
       ORDER BY qr.created_at ASC`
    : `SELECT q.name, qr.status FROM questionnaire_responses qr
       JOIN questionnaires q ON qr.questionnaire_id = q.id
       WHERE qr.client_id = ? AND qr.status != 'completed'
       ORDER BY qr.created_at ASC`;
  const qParams = projectId ? [clientId, projectId] : [clientId];

  const questionnaires = (await db.all(questionnaireQuery, qParams)) as Array<{
    name: string; status: string;
  }>;

  if (questionnaires.length > 0) {
    sections.push({
      title: 'Questionnaires',
      items: questionnaires.map(q => ({
        label: `Complete: ${q.name}`,
        completed: false,
        required: true,
        priority: 'high' as const
      }))
    });
  }

  // 4. Content requests
  const contentQuery = projectId
    ? `SELECT cri.title, cri.description, cri.status, cri.due_date, crc.name as checklist_name
       FROM content_request_items cri
       JOIN content_request_checklists crc ON cri.checklist_id = crc.id
       WHERE crc.client_id = ? AND crc.project_id = ? AND cri.status = 'pending'
       ORDER BY cri.sort_order ASC`
    : `SELECT cri.title, cri.description, cri.status, cri.due_date, crc.name as checklist_name
       FROM content_request_items cri
       JOIN content_request_checklists crc ON cri.checklist_id = crc.id
       WHERE crc.client_id = ? AND cri.status = 'pending'
       ORDER BY cri.sort_order ASC`;
  const contentParams = projectId ? [clientId, projectId] : [clientId];

  const contentItems = (await db.all(contentQuery, contentParams)) as Array<{
    title: string; description: string | null; status: string;
    due_date: string | null; checklist_name: string;
  }>;

  if (contentItems.length > 0) {
    sections.push({
      title: 'Content & Assets Needed',
      items: contentItems.map(c => ({
        label: c.title,
        description: c.description || undefined,
        completed: false,
        dueDate: c.due_date || undefined,
        required: true
      }))
    });
  }

  // 5. Unpaid invoices
  const invoiceQuery = projectId
    ? `SELECT i.invoice_number, i.amount_total, i.due_date, i.status
       FROM invoices i
       JOIN projects p ON i.project_id = p.id
       WHERE p.client_id = ? AND i.project_id = ? AND i.status IN ('sent', 'overdue', 'pending')
       AND i.deleted_at IS NULL ORDER BY i.due_date ASC`
    : `SELECT i.invoice_number, i.amount_total, i.due_date, i.status
       FROM invoices i
       JOIN projects p ON i.project_id = p.id
       WHERE p.client_id = ? AND i.status IN ('sent', 'overdue', 'pending')
       AND i.deleted_at IS NULL ORDER BY i.due_date ASC`;
  const invParams = projectId ? [clientId, projectId] : [clientId];

  const invoices = (await db.all(invoiceQuery, invParams)) as Array<{
    invoice_number: string; amount_total: number; due_date: string | null; status: string;
  }>;

  if (invoices.length > 0) {
    sections.push({
      title: 'Payments Due',
      items: invoices.map(inv => ({
        label: `${inv.invoice_number} — $${inv.amount_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        completed: false,
        dueDate: inv.due_date || undefined,
        required: true,
        priority: inv.status === 'overdue' ? 'urgent' as const : 'normal' as const
      }))
    });
  }

  const today = new Date();
  const generatedDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return {
    clientName: client.name,
    clientCompany: client.company_name || undefined,
    projectName,
    generatedDate,
    introText: 'Here is a summary of outstanding items we need from you to keep your project on track. Please complete these at your earliest convenience.',
    sections
  };
}

// ============================================
// FROM MARKDOWN
// ============================================

/**
 * Parse a markdown checklist file into ChecklistPdfData.
 * Expected format:
 *   # Title (becomes intro)
 *   ## Section Name
 *   - [ ] Unchecked item
 *   - [x] Checked item
 *   - [ ] **[URGENT]** Item with priority
 *   - [ ] Item (optional)
 */
function parseMarkdownChecklist(markdown: string, clientName: string, clientCompany?: string, projectName?: string): ChecklistPdfData {
  const lines = markdown.split('\n');
  const sections: ChecklistSection[] = [];
  let introText = '';
  let currentSection: ChecklistSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // H1 = intro text
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      introText = trimmed.slice(2).trim();
      continue;
    }

    // H2 = section
    if (trimmed.startsWith('## ')) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: trimmed.slice(3).trim(), items: [] };
      continue;
    }

    // Checklist item: - [ ] or - [x]
    const checkMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)$/);
    if (checkMatch && currentSection) {
      const completed = checkMatch[1].toLowerCase() === 'x';
      let label = checkMatch[2].trim();

      // Parse priority tag: **[URGENT]**, **[HIGH]**, etc.
      let priority: ChecklistItem['priority'] = undefined;
      const priorityMatch = label.match(/^\*?\*?\[(\w+)\]\*?\*?\s*/);
      if (priorityMatch) {
        const tag = priorityMatch[1].toLowerCase();
        if (['urgent', 'high', 'normal', 'low'].includes(tag)) {
          priority = tag as ChecklistItem['priority'];
        }
        label = label.slice(priorityMatch[0].length);
      }

      // Parse (optional) suffix
      let required: boolean | undefined;
      if (label.endsWith('(optional)')) {
        required = false;
        label = label.slice(0, -10).trim();
      }

      // Parse due date: — due March 14, 2026
      let dueDate: string | undefined;
      const dueMatch = label.match(/\s*[—-]\s*due\s+(.+)$/i);
      if (dueMatch) {
        dueDate = dueMatch[1].trim();
        label = label.slice(0, -dueMatch[0].length).trim();
      }

      currentSection.items.push({ label, completed, priority, required, dueDate });
      continue;
    }

    // Regular bullet with description for previous item
    if (trimmed.startsWith('- ') && currentSection && currentSection.items.length > 0 && !trimmed.match(/^-\s*\[/)) {
      const lastItem = currentSection.items[currentSection.items.length - 1];
      lastItem.description = trimmed.slice(2).trim();
    }
  }

  // Push last section
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  const today = new Date();
  return {
    clientName,
    clientCompany,
    projectName,
    generatedDate: today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    introText: introText || undefined,
    sections
  };
}

// ============================================
// FROM JSON
// ============================================

/**
 * Build ChecklistPdfData from a JSON template + overrides.
 */
function buildFromTemplate(
  templateName: string,
  clientName: string,
  clientCompany?: string,
  projectName?: string,
  overrides?: { introText?: string; additionalItems?: Record<string, ChecklistItem[]> }
): ChecklistPdfData {
  const template = CHECKLIST_TEMPLATES[templateName];
  if (!template) throw new Error(`Template "${templateName}" not found. Available: ${Object.keys(CHECKLIST_TEMPLATES).join(', ')}`);

  const sections: ChecklistSection[] = template.sections.map(s => ({
    title: s.title,
    items: s.items.map(i => ({
      label: i.label,
      description: i.description,
      completed: false,
      required: i.required,
      priority: i.priority
    }))
  }));

  // Merge additional items into matching sections or create new ones
  if (overrides?.additionalItems) {
    for (const [sectionTitle, items] of Object.entries(overrides.additionalItems)) {
      const existing = sections.find(s => s.title === sectionTitle);
      if (existing) {
        existing.items.push(...items);
      } else {
        sections.push({ title: sectionTitle, items });
      }
    }
  }

  const today = new Date();
  return {
    clientName,
    clientCompany,
    projectName,
    generatedDate: today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    introText: overrides?.introText || template.introText,
    sections
  };
}

/**
 * Build ChecklistPdfData from raw JSON (ChecklistPdfData format).
 */
function buildFromJson(json: ChecklistPdfData): ChecklistPdfData {
  if (!json.generatedDate) {
    json.generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return json;
}

// ============================================
// FROM MARKDOWN FILE
// ============================================

/**
 * Read a markdown file and generate a checklist PDF.
 */
async function generateFromMarkdownFile(
  filePath: string,
  clientName: string,
  clientCompany?: string,
  projectName?: string
): Promise<Uint8Array> {
  const markdown = readFileSync(filePath, 'utf-8');
  const data = parseMarkdownChecklist(markdown, clientName, clientCompany, projectName);
  return generateChecklistPdf(data);
}

// ============================================
// Singleton Export
// ============================================

export const checklistPdfService = {
  generateChecklistPdf,
  buildChecklistFromDb,
  parseMarkdownChecklist,
  buildFromTemplate,
  buildFromJson,
  generateFromMarkdownFile
};
