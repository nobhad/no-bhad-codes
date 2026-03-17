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

import { PDFDocument } from 'pdf-lib';
import { getDatabase } from '../database/init.js';
import { BUSINESS_INFO } from '../config/business.js';
import { PDF_COLORS, PDF_TYPOGRAPHY, PDF_SPACING } from '../config/pdf-styles.js';
import {
  createPdfContext,
  drawPdfDocumentHeader,
  drawPdfFooter,
  drawWrappedText,
  ensureSpace,
  addPageNumbers,
  setPdfMetadata,
  drawTwoColumnInfo,
  drawSectionLabel,
  drawLabelValue,
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
  const project = (await db.get(
    `
    SELECT
      p.id, p.project_name as name, p.status, p.priority,
      p.created_at, p.start_date, p.estimated_end_date as deadline, p.actual_end_date as completed_date,
      p.description, p.project_type, p.budget_range as budget,
      COALESCE(c.billing_name, c.contact_name) as client_name,
      COALESCE(c.billing_email, c.email) as client_email,
      COALESCE(c.billing_company, c.company_name) as client_company
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.id = ? AND p.deleted_at IS NULL
  `,
    [projectId]
  )) as unknown as ProjectRow | undefined;

  if (!project) return null;

  // Fetch milestones
  const milestonesRaw = await db.all(
    `
    SELECT title, description, due_date, is_completed, completed_date
    FROM milestones
    WHERE project_id = ?
    ORDER BY due_date ASC, created_at ASC
  `,
    [projectId]
  );
  const milestones = milestonesRaw as unknown as MilestoneRow[];

  // Fetch time tracking entries
  const timeEntriesRaw = await db.all(
    `
    SELECT description, hours, date
    FROM time_entries
    WHERE project_id = ?
    ORDER BY date DESC
    LIMIT 50
  `,
    [projectId]
  );
  const timeEntries = timeEntriesRaw as unknown as TimeEntryRow[];

  const totalHoursRow = (await db.get(
    `
    SELECT COALESCE(SUM(hours), 0) as total
    FROM time_entries
    WHERE project_id = ?
  `,
    [projectId]
  )) as unknown as { total: number } | undefined;

  // Fetch deliverables
  const deliverablesRaw = await db.all(
    `
    SELECT title as name, status, created_at as submitted_at, approved_at
    FROM deliverables
    WHERE project_id = ?
    ORDER BY created_at ASC
  `,
    [projectId]
  );
  const deliverables = deliverablesRaw as unknown as DeliverableRow[];

  // Fetch financial summary
  const invoicesRaw = await db.all(
    `
    SELECT invoice_number, amount_total as total_amount, status, due_date
    FROM invoices
    WHERE project_id = ?
    ORDER BY created_at DESC
  `,
    [projectId]
  );
  const invoices = invoicesRaw as unknown as InvoiceRow[];

  const financialSummary = (await db.get(
    `
    SELECT
      COALESCE(SUM(amount_total), 0) as total_invoiced,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_total ELSE 0 END), 0) as total_paid
    FROM invoices
    WHERE project_id = ?
  `,
    [projectId]
  )) as unknown as { total_invoiced: number; total_paid: number } | undefined;

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
    milestones: milestones.map((m) => ({
      title: m.title,
      description: m.description,
      dueDate: m.due_date,
      isCompleted: m.is_completed === 1,
      completedDate: m.completed_date
    })),
    timeTracking: {
      totalHours: totalHoursRow?.total || 0,
      entries: timeEntries.map((e) => ({
        description: e.description,
        hours: e.hours,
        date: e.date
      }))
    },
    deliverables: deliverables.map((d) => ({
      name: d.name,
      status: d.status,
      submittedAt: d.submitted_at,
      approvedAt: d.approved_at
    })),
    financial: {
      totalInvoiced: financialSummary?.total_invoiced || 0,
      totalPaid: financialSummary?.total_paid || 0,
      outstanding: (financialSummary?.total_invoiced || 0) - (financialSummary?.total_paid || 0),
      invoices: invoices.map((i) => ({
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
  const { leftMargin, rightMargin, fonts } = ctx;
  const lineHeight = PDF_SPACING.lineHeight;
  const labelWidth = 120;

  // Continuation header on new pages
  const onNewPage = (pageCtx: PdfPageContext) => {
    pageCtx.currentPage.drawText(`Project Report: ${data.project.name} (continued)`, {
      x: pageCtx.leftMargin,
      y: pageCtx.height - 30,
      size: PDF_TYPOGRAPHY.bodySize,
      font: pageCtx.fonts.regular,
      color: PDF_COLORS.black
    });
    pageCtx.y = pageCtx.height - pageCtx.topMargin - 20;
  };

  // === HEADER ===
  ctx.y = await drawPdfDocumentHeader({
    page: ctx.currentPage,
    pdfDoc,
    fonts,
    startY: ctx.y,
    leftMargin,
    rightMargin,
    title: 'PROJECT REPORT'
  });

  // === TWO-COLUMN INFO: PROJECT / REPORT DETAILS ===
  const leftLines: Array<{ text: string; bold?: boolean }> = [
    { text: data.project.name, bold: true },
    { text: `CLIENT: ${data.client.name}${data.client.company ? ` (${data.client.company})` : ''}` }
  ];

  const rightPairs: Array<{ label: string; value: string }> = [
    { label: 'STATUS:', value: formatStatus(data.project.status) },
    { label: 'PRIORITY:', value: formatStatus(data.project.priority || 'Normal') },
    { label: 'TYPE:', value: formatStatus(data.project.projectType || 'Not specified') },
    { label: 'GENERATED:', value: formatDate(new Date().toISOString()) }
  ];

  ctx.y = drawTwoColumnInfo(ctx.currentPage, {
    leftMargin,
    rightMargin,
    width: ctx.width,
    y: ctx.y,
    fonts,
    left: { label: 'PROJECT:', lines: leftLines },
    right: { pairs: rightPairs }
  });

  // === PROJECT OVERVIEW ===
  ctx.y -= PDF_SPACING.sectionSpacing;
  ensureSpace(ctx, 100, onNewPage);
  ctx.y = drawSectionLabel(ctx.currentPage, 'PROJECT OVERVIEW', {
    x: leftMargin, y: ctx.y, font: fonts.bold
  });

  ctx.y = drawLabelValue(ctx.currentPage, 'START DATE:', formatDate(data.project.startDate), {
    x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
  });
  ctx.y = drawLabelValue(ctx.currentPage, 'DEADLINE:', formatDate(data.project.deadline), {
    x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
  });
  if (data.project.budget) {
    ctx.y = drawLabelValue(ctx.currentPage, 'BUDGET:', formatCurrency(data.project.budget), {
      x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
    });
  }

  if (data.project.description) {
    ctx.y -= 8;
    ctx.y = drawLabelValue(ctx.currentPage, 'DESCRIPTION:', '', {
      x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
    });
    drawWrappedText(ctx, data.project.description, {
      fontSize: PDF_TYPOGRAPHY.bodySize,
      color: PDF_COLORS.black,
      lineHeight,
      onNewPage
    });
  }

  // === MILESTONES ===
  if (data.milestones.length > 0) {
    ctx.y -= PDF_SPACING.sectionSpacing;
    ensureSpace(ctx, 100, onNewPage);
    ctx.y = drawSectionLabel(ctx.currentPage, 'MILESTONES', {
      x: leftMargin, y: ctx.y, font: fonts.bold
    });

    const completed = data.milestones.filter((m) => m.isCompleted).length;
    const total = data.milestones.length;

    ctx.y = drawLabelValue(ctx.currentPage, 'PROGRESS:', `${completed}/${total} completed (${Math.round((completed / total) * 100)}%)`, {
      x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
    });
    ctx.y -= 8;

    for (const milestone of data.milestones) {
      ensureSpace(ctx, 30, onNewPage);

      const checkmark = milestone.isCompleted ? '[x]' : '[ ]';
      ctx.currentPage.drawText(checkmark, {
        x: leftMargin,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.regular,
        color: PDF_COLORS.black
      });

      ctx.currentPage.drawText(milestone.title, {
        x: leftMargin + 25,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.bold,
        color: PDF_COLORS.black
      });

      if (milestone.dueDate) {
        const dueDateText = formatDate(milestone.dueDate);
        const dueDateW = fonts.regular.widthOfTextAtSize(dueDateText, PDF_TYPOGRAPHY.bodySize);
        ctx.currentPage.drawText(dueDateText, {
          x: rightMargin - dueDateW,
          y: ctx.y,
          size: PDF_TYPOGRAPHY.bodySize,
          font: fonts.regular,
          color: PDF_COLORS.black
        });
      }

      ctx.y -= lineHeight;
    }
  }

  // === DELIVERABLES ===
  if (data.deliverables.length > 0) {
    ctx.y -= PDF_SPACING.sectionSpacing;
    ensureSpace(ctx, 100, onNewPage);
    ctx.y = drawSectionLabel(ctx.currentPage, 'DELIVERABLES', {
      x: leftMargin, y: ctx.y, font: fonts.bold
    });

    for (const deliverable of data.deliverables) {
      ensureSpace(ctx, 20, onNewPage);

      ctx.currentPage.drawText(`- ${deliverable.name}`, {
        x: leftMargin,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.regular,
        color: PDF_COLORS.black
      });

      const statusText = formatStatus(deliverable.status);
      const statusW = fonts.regular.widthOfTextAtSize(statusText, PDF_TYPOGRAPHY.bodySize);
      ctx.currentPage.drawText(statusText, {
        x: rightMargin - statusW,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.regular,
        color: PDF_COLORS.black
      });

      ctx.y -= lineHeight;
    }
  }

  // === TIME TRACKING ===
  if (data.timeTracking.totalHours > 0) {
    ctx.y -= PDF_SPACING.sectionSpacing;
    ensureSpace(ctx, 100, onNewPage);
    ctx.y = drawSectionLabel(ctx.currentPage, 'TIME TRACKING', {
      x: leftMargin, y: ctx.y, font: fonts.bold
    });

    ctx.y = drawLabelValue(ctx.currentPage, 'TOTAL HOURS:', data.timeTracking.totalHours.toFixed(1), {
      x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
    });

    if (data.timeTracking.entries.length > 0) {
      ctx.y -= 8;
      ctx.y = drawLabelValue(ctx.currentPage, 'RECENT ENTRIES:', '', {
        x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
      });

      const MAX_TIME_ENTRIES = 10;
      const entriesToShow = data.timeTracking.entries.slice(0, MAX_TIME_ENTRIES);
      for (const entry of entriesToShow) {
        ensureSpace(ctx, lineHeight, onNewPage);

        ctx.currentPage.drawText(`${formatDate(entry.date)} - ${entry.hours.toFixed(1)}h`, {
          x: leftMargin + PDF_SPACING.indent,
          y: ctx.y,
          size: PDF_TYPOGRAPHY.bodySize,
          font: fonts.regular,
          color: PDF_COLORS.black
        });

        const MAX_DESC_LENGTH = 60;
        const TRUNCATED_DESC_LENGTH = 57;
        const desc = entry.description.length > MAX_DESC_LENGTH
          ? `${entry.description.substring(0, TRUNCATED_DESC_LENGTH)}...`
          : entry.description;

        ctx.currentPage.drawText(desc, {
          x: leftMargin + labelWidth,
          y: ctx.y,
          size: PDF_TYPOGRAPHY.bodySize,
          font: fonts.regular,
          color: PDF_COLORS.black
        });

        ctx.y -= lineHeight;
      }

      if (data.timeTracking.entries.length > MAX_TIME_ENTRIES) {
        ctx.currentPage.drawText(`... and ${data.timeTracking.entries.length - MAX_TIME_ENTRIES} more entries`, {
          x: leftMargin + PDF_SPACING.indent,
          y: ctx.y,
          size: PDF_TYPOGRAPHY.bodySize,
          font: fonts.regular,
          color: PDF_COLORS.black
        });
        ctx.y -= lineHeight;
      }
    }
  }

  // === FINANCIAL SUMMARY ===
  ctx.y -= PDF_SPACING.sectionSpacing;
  ensureSpace(ctx, 150, onNewPage);
  ctx.y = drawSectionLabel(ctx.currentPage, 'FINANCIAL SUMMARY', {
    x: leftMargin, y: ctx.y, font: fonts.bold
  });

  ctx.y = drawLabelValue(ctx.currentPage, 'TOTAL INVOICED:', formatCurrency(data.financial.totalInvoiced), {
    x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
  });
  ctx.y = drawLabelValue(ctx.currentPage, 'TOTAL PAID:', formatCurrency(data.financial.totalPaid), {
    x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
  });
  ctx.y = drawLabelValue(ctx.currentPage, 'OUTSTANDING:', formatCurrency(data.financial.outstanding), {
    x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
  });

  // Invoice list
  if (data.financial.invoices.length > 0) {
    ctx.y -= 8;
    ctx.y = drawLabelValue(ctx.currentPage, 'INVOICES:', '', {
      x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
    });

    const MAX_INVOICE_ENTRIES = 10;
    for (const invoice of data.financial.invoices.slice(0, MAX_INVOICE_ENTRIES)) {
      ensureSpace(ctx, lineHeight, onNewPage);

      ctx.currentPage.drawText(invoice.invoiceNumber, {
        x: leftMargin + PDF_SPACING.indent,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.regular,
        color: PDF_COLORS.black
      });

      ctx.currentPage.drawText(formatCurrency(invoice.amount), {
        x: leftMargin + labelWidth,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.regular,
        color: PDF_COLORS.black
      });

      const invoiceStatusText = formatStatus(invoice.status);
      const invoiceStatusW = fonts.regular.widthOfTextAtSize(invoiceStatusText, PDF_TYPOGRAPHY.bodySize);
      ctx.currentPage.drawText(invoiceStatusText, {
        x: rightMargin - invoiceStatusW,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.regular,
        color: PDF_COLORS.black
      });

      ctx.y -= lineHeight;
    }
  }

  // === FOOTER — on all pages ===
  for (const footerPage of pdfDoc.getPages()) {
    drawPdfFooter(footerPage, {
      leftMargin,
      rightMargin,
      width: ctx.width,
      fonts,
      thankYouText: 'Thank you for your business!'
    });
  }

  await addPageNumbers(pdfDoc);

  return pdfDoc.save();
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
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
