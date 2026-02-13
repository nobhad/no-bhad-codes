/**
 * ===============================================
 * PROJECT REPORT SERVICE
 * ===============================================
 * @file server/services/project-report-service.ts
 *
 * Generates comprehensive PDF reports for projects including:
 * - Project overview and status
 * - Milestone progress
 * - Time tracking summary
 * - Deliverables status
 * - Financial summary
 */

import { PDFDocument, rgb } from 'pdf-lib';
import { getDatabase } from '../database/init.js';
import { BUSINESS_INFO, getPdfLogoBytes } from '../config/business.js';
import {
  createPdfContext,
  drawWrappedText,
  ensureSpace,
  addPageNumbers,
  setPdfMetadata,
  PAGE_MARGINS,
  type PdfPageContext
} from '../utils/pdf-utils.js';

// ============================================
// TYPES
// ============================================

interface ProjectReportData {
  project: {
    id: number;
    name: string;
    status: string;
    priority: string;
    createdAt: string;
    startDate: string | null;
    deadline: string | null;
    completedDate: string | null;
    description: string | null;
    projectType: string | null;
    budget: number | null;
  };
  client: {
    name: string;
    email: string;
    company: string | null;
  };
  milestones: Array<{
    title: string;
    description: string | null;
    dueDate: string | null;
    isCompleted: boolean;
    completedDate: string | null;
  }>;
  timeTracking: {
    totalHours: number;
    entries: Array<{
      description: string;
      hours: number;
      date: string;
    }>;
  };
  deliverables: Array<{
    name: string;
    status: string;
    submittedAt: string | null;
    approvedAt: string | null;
  }>;
  financial: {
    totalInvoiced: number;
    totalPaid: number;
    outstanding: number;
    invoices: Array<{
      invoiceNumber: string;
      amount: number;
      status: string;
      dueDate: string | null;
    }>;
  };
}

// ============================================
// DATA FETCHING
// ============================================

// Row types for database queries
interface ProjectRow {
  id: number;
  name: string;
  status: string;
  priority: string;
  created_at: string;
  start_date: string | null;
  deadline: string | null;
  completed_date: string | null;
  description: string | null;
  project_type: string | null;
  budget: number | null;
  client_name: string;
  client_email: string;
  client_company: string | null;
}

interface MilestoneRow {
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: number;
  completed_date: string | null;
}

interface TimeEntryRow {
  description: string;
  hours: number;
  date: string;
}

interface DeliverableRow {
  name: string;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
}

interface InvoiceRow {
  invoice_number: string;
  total_amount: number;
  status: string;
  due_date: string | null;
}

/**
 * Fetch all data needed for a project report
 */
export async function fetchProjectReportData(projectId: number): Promise<ProjectReportData | null> {
  const db = await getDatabase();

  // Fetch project with client info
  const project = await db.get(`
    SELECT
      p.id, p.name, p.status, p.priority,
      p.created_at, p.start_date, p.deadline, p.completed_date,
      p.description, p.project_type, p.budget,
      c.name as client_name, c.email as client_email, c.company as client_company
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.id = ?
  `, [projectId]) as unknown as ProjectRow | undefined;

  if (!project) return null;

  // Fetch milestones
  const milestonesRaw = await db.all(`
    SELECT title, description, due_date, is_completed, completed_date
    FROM milestones
    WHERE project_id = ?
    ORDER BY due_date ASC, created_at ASC
  `, [projectId]);
  const milestones = milestonesRaw as unknown as MilestoneRow[];

  // Fetch time tracking entries
  const timeEntriesRaw = await db.all(`
    SELECT description, hours, date
    FROM time_entries
    WHERE project_id = ?
    ORDER BY date DESC
    LIMIT 50
  `, [projectId]);
  const timeEntries = timeEntriesRaw as unknown as TimeEntryRow[];

  const totalHoursRow = await db.get(`
    SELECT COALESCE(SUM(hours), 0) as total
    FROM time_entries
    WHERE project_id = ?
  `, [projectId]) as unknown as { total: number } | undefined;

  // Fetch deliverables
  const deliverablesRaw = await db.all(`
    SELECT name, status, submitted_at, approved_at
    FROM deliverables
    WHERE project_id = ?
    ORDER BY created_at ASC
  `, [projectId]);
  const deliverables = deliverablesRaw as unknown as DeliverableRow[];

  // Fetch financial summary
  const invoicesRaw = await db.all(`
    SELECT invoice_number, total_amount, status, due_date
    FROM invoices
    WHERE project_id = ?
    ORDER BY created_at DESC
  `, [projectId]);
  const invoices = invoicesRaw as unknown as InvoiceRow[];

  const financialSummary = await db.get(`
    SELECT
      COALESCE(SUM(total_amount), 0) as total_invoiced,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as total_paid
    FROM invoices
    WHERE project_id = ?
  `, [projectId]) as unknown as { total_invoiced: number; total_paid: number } | undefined;

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      priority: project.priority,
      createdAt: project.created_at,
      startDate: project.start_date,
      deadline: project.deadline,
      completedDate: project.completed_date,
      description: project.description,
      projectType: project.project_type,
      budget: project.budget
    },
    client: {
      name: project.client_name || 'Unknown Client',
      email: project.client_email || '',
      company: project.client_company
    },
    milestones: milestones.map(m => ({
      title: m.title,
      description: m.description,
      dueDate: m.due_date,
      isCompleted: m.is_completed === 1,
      completedDate: m.completed_date
    })),
    timeTracking: {
      totalHours: totalHoursRow?.total || 0,
      entries: timeEntries.map(e => ({
        description: e.description,
        hours: e.hours,
        date: e.date
      }))
    },
    deliverables: deliverables.map(d => ({
      name: d.name,
      status: d.status,
      submittedAt: d.submitted_at,
      approvedAt: d.approved_at
    })),
    financial: {
      totalInvoiced: financialSummary?.total_invoiced || 0,
      totalPaid: financialSummary?.total_paid || 0,
      outstanding: (financialSummary?.total_invoiced || 0) - (financialSummary?.total_paid || 0),
      invoices: invoices.map(i => ({
        invoiceNumber: i.invoice_number,
        amount: i.total_amount,
        status: i.status,
        dueDate: i.due_date
      }))
    }
  };
}

// ============================================
// PDF GENERATION
// ============================================

/**
 * Generate a comprehensive project report PDF
 */
export async function generateProjectReportPdf(data: ProjectReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  setPdfMetadata(pdfDoc, {
    title: `Project Report - ${data.project.name}`,
    author: BUSINESS_INFO.name,
    subject: 'Project Status Report',
    creator: 'NoBhadCodes',
    creationDate: new Date()
  });

  const ctx = await createPdfContext(pdfDoc);

  // Draw header on new pages
  const onNewPage = (pageCtx: PdfPageContext) => {
    drawPageHeader(pageCtx, data.project.name);
  };

  // === PAGE 1: HEADER ===
  await drawReportHeader(ctx, data);

  // === PROJECT OVERVIEW ===
  ctx.y -= 20;
  drawSectionTitle(ctx, 'PROJECT OVERVIEW');
  ctx.y -= 5;
  drawProjectOverview(ctx, data);

  // === MILESTONES ===
  if (data.milestones.length > 0) {
    ctx.y -= 25;
    ensureSpace(ctx, 100, onNewPage);
    drawSectionTitle(ctx, 'MILESTONES');
    ctx.y -= 5;
    drawMilestones(ctx, data.milestones, onNewPage);
  }

  // === DELIVERABLES ===
  if (data.deliverables.length > 0) {
    ctx.y -= 25;
    ensureSpace(ctx, 100, onNewPage);
    drawSectionTitle(ctx, 'DELIVERABLES');
    ctx.y -= 5;
    drawDeliverables(ctx, data.deliverables, onNewPage);
  }

  // === TIME TRACKING ===
  if (data.timeTracking.totalHours > 0) {
    ctx.y -= 25;
    ensureSpace(ctx, 100, onNewPage);
    drawSectionTitle(ctx, 'TIME TRACKING');
    ctx.y -= 5;
    drawTimeTracking(ctx, data.timeTracking, onNewPage);
  }

  // === FINANCIAL SUMMARY ===
  ctx.y -= 25;
  ensureSpace(ctx, 150, onNewPage);
  drawSectionTitle(ctx, 'FINANCIAL SUMMARY');
  ctx.y -= 5;
  drawFinancialSummary(ctx, data.financial, onNewPage);

  // Add page numbers
  await addPageNumbers(pdfDoc);

  return pdfDoc.save();
}

// ============================================
// PDF DRAWING HELPERS
// ============================================

function drawPageHeader(ctx: PdfPageContext, projectName: string): void {
  ctx.currentPage.drawText(`Project Report: ${projectName}`, {
    x: ctx.leftMargin,
    y: ctx.height - 30,
    size: 10,
    font: ctx.fonts.regular,
    color: rgb(0.5, 0.5, 0.5)
  });
  ctx.y = ctx.height - ctx.topMargin - 20;
}

async function drawReportHeader(ctx: PdfPageContext, data: ProjectReportData): Promise<void> {
  const { currentPage, leftMargin, fonts, y: startY } = ctx;
  let y = startY;

  // Logo
  const logoBytes = getPdfLogoBytes();
  if (logoBytes) {
    const logoImage = await ctx.pdfDoc.embedPng(logoBytes);
    const logoHeight = 60;
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    currentPage.drawImage(logoImage, {
      x: ctx.rightMargin - logoWidth,
      y: y - logoHeight + 10,
      width: logoWidth,
      height: logoHeight
    });
  }

  // Title
  currentPage.drawText('PROJECT REPORT', {
    x: leftMargin,
    y,
    size: 24,
    font: fonts.bold,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= 30;

  // Project name
  currentPage.drawText(data.project.name, {
    x: leftMargin,
    y,
    size: 16,
    font: fonts.bold,
    color: rgb(0.2, 0.2, 0.2)
  });
  y -= 20;

  // Client
  currentPage.drawText(`Client: ${data.client.name}${data.client.company ? ` (${data.client.company})` : ''}`, {
    x: leftMargin,
    y,
    size: 11,
    font: fonts.regular,
    color: rgb(0.3, 0.3, 0.3)
  });
  y -= 15;

  // Generated date
  currentPage.drawText(`Generated: ${formatDate(new Date().toISOString())}`, {
    x: leftMargin,
    y,
    size: 10,
    font: fonts.regular,
    color: rgb(0.5, 0.5, 0.5)
  });
  y -= 20;

  // Divider
  currentPage.drawLine({
    start: { x: leftMargin, y },
    end: { x: ctx.rightMargin, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8)
  });

  ctx.y = y - 10;
}

function drawSectionTitle(ctx: PdfPageContext, title: string): void {
  ctx.currentPage.drawText(title, {
    x: ctx.leftMargin,
    y: ctx.y,
    size: 14,
    font: ctx.fonts.bold,
    color: rgb(0.15, 0.15, 0.15)
  });
  ctx.y -= 5;

  // Underline
  ctx.currentPage.drawLine({
    start: { x: ctx.leftMargin, y: ctx.y },
    end: { x: ctx.leftMargin + 150, y: ctx.y },
    thickness: 2,
    color: rgb(0.5, 0.99, 0.04) // Brand green
  });
  ctx.y -= 15;
}

function drawProjectOverview(ctx: PdfPageContext, data: ProjectReportData): void {
  const labelWidth = 100;
  const lineHeight = 16;

  const fields = [
    ['Status', formatStatus(data.project.status)],
    ['Priority', data.project.priority || 'Normal'],
    ['Project Type', data.project.projectType || 'Not specified'],
    ['Start Date', formatDate(data.project.startDate)],
    ['Deadline', formatDate(data.project.deadline)],
    ['Budget', data.project.budget ? formatCurrency(data.project.budget) : 'Not specified']
  ];

  for (const [label, value] of fields) {
    ctx.currentPage.drawText(`${label}:`, {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.bold,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.currentPage.drawText(value, {
      x: ctx.leftMargin + labelWidth,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.regular,
      color: rgb(0.1, 0.1, 0.1)
    });
    ctx.y -= lineHeight;
  }

  // Description
  if (data.project.description) {
    ctx.y -= 5;
    ctx.currentPage.drawText('Description:', {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.bold,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.y -= 14;
    drawWrappedText(ctx, data.project.description, {
      fontSize: 10,
      color: rgb(0.2, 0.2, 0.2),
      lineHeight: 14
    });
  }
}

function drawMilestones(
  ctx: PdfPageContext,
  milestones: ProjectReportData['milestones'],
  onNewPage: (ctx: PdfPageContext) => void
): void {
  const completed = milestones.filter(m => m.isCompleted).length;
  const total = milestones.length;

  // Summary
  ctx.currentPage.drawText(`Progress: ${completed}/${total} completed (${Math.round((completed / total) * 100)}%)`, {
    x: ctx.leftMargin,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.bold,
    color: rgb(0.2, 0.2, 0.2)
  });
  ctx.y -= 18;

  // List milestones
  for (const milestone of milestones) {
    ensureSpace(ctx, 40, onNewPage);

    const checkmark = milestone.isCompleted ? '[x]' : '[ ]';
    const statusColor = milestone.isCompleted ? rgb(0.13, 0.55, 0.13) : rgb(0.3, 0.3, 0.3);

    ctx.currentPage.drawText(checkmark, {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.regular,
      color: statusColor
    });

    ctx.currentPage.drawText(milestone.title, {
      x: ctx.leftMargin + 25,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.bold,
      color: rgb(0.1, 0.1, 0.1)
    });

    if (milestone.dueDate) {
      ctx.currentPage.drawText(`Due: ${formatDate(milestone.dueDate)}`, {
        x: ctx.rightMargin - 100,
        y: ctx.y,
        size: 9,
        font: ctx.fonts.regular,
        color: rgb(0.5, 0.5, 0.5)
      });
    }

    ctx.y -= 16;
  }
}

function drawDeliverables(
  ctx: PdfPageContext,
  deliverables: ProjectReportData['deliverables'],
  onNewPage: (ctx: PdfPageContext) => void
): void {
  for (const deliverable of deliverables) {
    ensureSpace(ctx, 30, onNewPage);

    ctx.currentPage.drawText(`- ${deliverable.name}`, {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.regular,
      color: rgb(0.1, 0.1, 0.1)
    });

    const statusColor = deliverable.status === 'approved'
      ? rgb(0.13, 0.55, 0.13)
      : deliverable.status === 'rejected'
        ? rgb(0.8, 0.2, 0.2)
        : rgb(0.5, 0.5, 0.5);

    ctx.currentPage.drawText(formatStatus(deliverable.status), {
      x: ctx.rightMargin - 80,
      y: ctx.y,
      size: 9,
      font: ctx.fonts.regular,
      color: statusColor
    });

    ctx.y -= 16;
  }
}

function drawTimeTracking(
  ctx: PdfPageContext,
  timeTracking: ProjectReportData['timeTracking'],
  onNewPage: (ctx: PdfPageContext) => void
): void {
  // Total hours
  ctx.currentPage.drawText(`Total Hours: ${timeTracking.totalHours.toFixed(1)}`, {
    x: ctx.leftMargin,
    y: ctx.y,
    size: 11,
    font: ctx.fonts.bold,
    color: rgb(0.1, 0.1, 0.1)
  });
  ctx.y -= 20;

  // Recent entries (limit to 10)
  if (timeTracking.entries.length > 0) {
    ctx.currentPage.drawText('Recent Entries:', {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.bold,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.y -= 14;

    const entriesToShow = timeTracking.entries.slice(0, 10);
    for (const entry of entriesToShow) {
      ensureSpace(ctx, 16, onNewPage);

      ctx.currentPage.drawText(`${formatDate(entry.date)} - ${entry.hours.toFixed(1)}h`, {
        x: ctx.leftMargin,
        y: ctx.y,
        size: 9,
        font: ctx.fonts.regular,
        color: rgb(0.4, 0.4, 0.4)
      });

      const descWidth = ctx.contentWidth - 100;
      const desc = entry.description.length > 60
        ? `${entry.description.substring(0, 57)  }...`
        : entry.description;

      ctx.currentPage.drawText(desc, {
        x: ctx.leftMargin + 100,
        y: ctx.y,
        size: 9,
        font: ctx.fonts.regular,
        color: rgb(0.2, 0.2, 0.2)
      });

      ctx.y -= 14;
    }

    if (timeTracking.entries.length > 10) {
      ctx.currentPage.drawText(`... and ${timeTracking.entries.length - 10} more entries`, {
        x: ctx.leftMargin,
        y: ctx.y,
        size: 9,
        font: ctx.fonts.regular,
        color: rgb(0.5, 0.5, 0.5)
      });
      ctx.y -= 14;
    }
  }
}

function drawFinancialSummary(
  ctx: PdfPageContext,
  financial: ProjectReportData['financial'],
  onNewPage: (ctx: PdfPageContext) => void
): void {
  const lineHeight = 18;

  // Summary boxes
  const summaryItems = [
    ['Total Invoiced', formatCurrency(financial.totalInvoiced)],
    ['Total Paid', formatCurrency(financial.totalPaid)],
    ['Outstanding', formatCurrency(financial.outstanding)]
  ];

  for (const [label, value] of summaryItems) {
    ctx.currentPage.drawText(`${label}:`, {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.bold,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.currentPage.drawText(value, {
      x: ctx.leftMargin + 120,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.regular,
      color: rgb(0.1, 0.1, 0.1)
    });
    ctx.y -= lineHeight;
  }

  // Invoice list
  if (financial.invoices.length > 0) {
    ctx.y -= 10;
    ensureSpace(ctx, 60, onNewPage);

    ctx.currentPage.drawText('Invoices:', {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.bold,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.y -= 16;

    for (const invoice of financial.invoices.slice(0, 10)) {
      ensureSpace(ctx, 16, onNewPage);

      ctx.currentPage.drawText(invoice.invoiceNumber, {
        x: ctx.leftMargin,
        y: ctx.y,
        size: 9,
        font: ctx.fonts.regular,
        color: rgb(0.2, 0.2, 0.2)
      });

      ctx.currentPage.drawText(formatCurrency(invoice.amount), {
        x: ctx.leftMargin + 100,
        y: ctx.y,
        size: 9,
        font: ctx.fonts.regular,
        color: rgb(0.2, 0.2, 0.2)
      });

      const statusColor = invoice.status === 'paid'
        ? rgb(0.13, 0.55, 0.13)
        : invoice.status === 'overdue'
          ? rgb(0.8, 0.2, 0.2)
          : rgb(0.5, 0.5, 0.5);

      ctx.currentPage.drawText(formatStatus(invoice.status), {
        x: ctx.rightMargin - 80,
        y: ctx.y,
        size: 9,
        font: ctx.fonts.regular,
        color: statusColor
      });

      ctx.y -= 14;
    }
  }
}

// ============================================
// FORMATTING HELPERS
// ============================================

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Not set';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
